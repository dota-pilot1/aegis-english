package com.cj.englishagenthub.mathextraction2.application;

import com.cj.englishagenthub.mathextraction2.application.StructuredMathExtractionService.ProgressListener;
import com.cj.englishagenthub.mathextraction2.domain.StructuredMathSheet;
import jakarta.annotation.PreDestroy;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 정형 추출의 비동기 잡 오케스트레이션 (Async Request-Reply).
 * POST는 즉시 jobId를 받고, 추출(60~70s)은 백그라운드에서 진행되며, 클라이언트는 상태를 폴링한다.
 * 게이트웨이(CloudFront 30s) 타임아웃과 무관해진다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StructuredMathJobService {

    private final StructuredMathExtractionService extractionService;
    private final StructuredMathSheetService sheetService;

    /** 동시에 도는 추출 잡 수 제한(각 잡이 내부적으로 또 병렬이라 과하면 안 됨). */
    private final ExecutorService pool = Executors.newFixedThreadPool(2);
    private final Map<String, Job> jobs = new ConcurrentHashMap<>();

    public enum State { PROCESSING, DONE, FAILED }

    @Getter
    public static class Job {
        private final long createdAt = System.currentTimeMillis();
        private volatile State state = State.PROCESSING;
        private volatile String sheetId;
        private volatile String error;
        private final AtomicInteger total = new AtomicInteger(0);
        private final AtomicInteger done = new AtomicInteger(0);
    }

    /** 추출 잡을 시작하고 jobId를 즉시 반환한다. */
    public String submit(Long userId, byte[] problemBytes, String fileName, byte[] answerBytes) {
        String jobId = UUID.randomUUID().toString();
        Job job = new Job();
        jobs.put(jobId, job);
        evictOld();
        pool.submit(() -> run(jobId, job, userId, problemBytes, fileName, answerBytes));
        return jobId;
    }

    public Job get(String jobId) {
        return jobs.get(jobId);
    }

    private void run(String jobId, Job job, Long userId, byte[] problemBytes, String fileName, byte[] answerBytes) {
        try {
            ProgressListener progress = new ProgressListener() {
                public void onTotal(int t) { job.total.set(t); }
                public void onItemDone() { job.done.incrementAndGet(); }
            };
            List<StructuredMathSheet.ItemSpec> specs = extractionService.extract(problemBytes, answerBytes, progress);
            String sheetId = sheetService.saveSheet(userId, fileName, specs);
            job.sheetId = sheetId;
            job.state = State.DONE;
            log.info("Structured job {} done — sheet {}", jobId, sheetId);
        } catch (Exception e) {
            job.error = e.getMessage();
            job.state = State.FAILED;
            log.warn("Structured job {} failed: {}", jobId, e.getMessage());
        }
    }

    /** 완료된 지 오래된 잡은 메모리에서 정리(1시간). */
    private void evictOld() {
        long cutoff = System.currentTimeMillis() - 3_600_000L;
        jobs.entrySet().removeIf(e -> e.getValue().state != State.PROCESSING && e.getValue().createdAt < cutoff);
    }

    @PreDestroy
    void shutdown() {
        pool.shutdownNow();
    }
}
