package com.cj.englishagenthub.mathextraction2.application;

import com.cj.englishagenthub.ai.infrastructure.OpenAiClientResolver;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.common.upload.UploadService;
import com.cj.englishagenthub.mathextraction.application.MathLayoutParser;
import com.cj.englishagenthub.mathextraction.application.MathLayoutParser.ParsedQuestion;
import com.cj.englishagenthub.mathextraction2.domain.StructuredMathSheet;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 정형 추출(추출기 2): 좌표 파서로 문항 크롭을 얻고, 문항별 Gemini Vision으로 발문·보기를 LaTeX 텍스트로 전사한다.
 * 도형은 별도 이미지로 분리 저장한다. 정답표는 이미지라 Vision으로 읽어 매핑한다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class StructuredMathExtractionService {

    private final MathLayoutParser layoutParser;
    private final OpenAiClientResolver openAiClientResolver;
    private final UploadService uploadService;

    private static final ObjectMapper objectMapper = new ObjectMapper();
    private static final int CONCURRENCY = 6;
    private static final float RENDER_DPI = 150f;
    private static final int DETECT_MAX_WIDTH = 1600;

    @Value("${gemini.api-key:}")
    private String geminiApiKey;
    @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta/openai}")
    private String geminiBaseUrl;
    @Value("${gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    /** 진행률 보고용 콜백. */
    public interface ProgressListener {
        void onTotal(int total);
        void onItemDone();
        ProgressListener NOOP = new ProgressListener() {
            public void onTotal(int total) {}
            public void onItemDone() {}
        };
    }

    /** bytes 기반(비동기 잡에서 호출). 트랜잭션 밖에서 실행되며 진행률을 콜백으로 보고한다. */
    public List<StructuredMathSheet.ItemSpec> extract(byte[] problemBytes, byte[] answerBytes, ProgressListener progress) {
        if (!StringUtils.hasText(geminiApiKey)) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NO_VISION);
        }
        long t0 = System.currentTimeMillis();

        List<ParsedQuestion> questions = layoutParser.parse(problemBytes);
        if (questions.isEmpty()) throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        progress.onTotal(questions.size());

        CompletableFuture<Map<String, AnswerInfo>> answerFuture = (answerBytes != null && answerBytes.length > 0)
                ? CompletableFuture.supplyAsync(() -> readAnswerKey(answerBytes))
                : CompletableFuture.completedFuture(Map.of());

        ChatClient client = openAiClientResolver.chatClientFor(geminiApiKey, geminiBaseUrl).build();

        // 문항별 Vision 전사 + 도형 업로드 (병렬).
        List<StructuredMathSheet.ItemSpec> specs = Collections.synchronizedList(new ArrayList<>());
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(CONCURRENCY, Math.max(1, questions.size())));
        try {
            Map<String, AnswerInfo> answers = answerFuture.get();
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            for (ParsedQuestion q : questions) {
                futures.add(CompletableFuture.runAsync(() -> {
                    try {
                        StructuredMathSheet.ItemSpec spec = transcribe(client, q, answers);
                        if (spec != null) specs.add(spec);
                    } finally {
                        progress.onItemDone();
                    }
                }, pool));
            }
            for (CompletableFuture<Void> f : futures) {
                try { f.get(); } catch (Exception e) { log.warn("Structured transcribe failed: {}", e.getMessage()); }
            }
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        } finally {
            pool.shutdown();
        }

        if (specs.isEmpty()) throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        specs.sort((a, b) -> {
            int sa = subjectOrder(a.subject()), sb = subjectOrder(b.subject());
            if (sa != sb) return Integer.compare(sa, sb);
            int na = a.questionNumber() == null ? Integer.MAX_VALUE : a.questionNumber();
            int nb = b.questionNumber() == null ? Integer.MAX_VALUE : b.questionNumber();
            return Integer.compare(na, nb);
        });
        log.info("Structured-extracted {} math questions in {}ms", specs.size(), System.currentTimeMillis() - t0);
        return specs;
    }

    private StructuredMathSheet.ItemSpec transcribe(ChatClient client, ParsedQuestion q, Map<String, AnswerInfo> answers) {
        try {
            // LLM 형식 준수는 확률적 → 발문이 비면 몇 번 재시도한다.
            Transcribed t = null;
            for (int attempt = 0; attempt < 3 && (t == null || !StringUtils.hasText(t.prompt())); attempt++) {
                String content = client.prompt()
                        .options(OpenAiChatOptions.builder().model(geminiModel).maxCompletionTokens(2000))
                        .system(transcribeSystemPrompt())
                        .user(u -> u.text("Transcribe this question.")
                                .media(MimeTypeUtils.IMAGE_PNG, new ByteArrayResource(q.questionPng())))
                        .call()
                        .content();
                t = parseTranscription(content);
            }
            boolean transcribed = t != null && StringUtils.hasText(t.prompt());
            String prompt = transcribed ? t.prompt() : q.text();
            List<String> choices = (t != null && t.choices() != null) ? t.choices() : List.of();

            String figureUrl = null;
            if (q.hasFigure() && q.figurePng() != null) {
                figureUrl = uploadService.putBytes(q.figurePng(), "image/png", "math-figure",
                        "fig-" + UUID.randomUUID() + ".png");
            }
            AnswerInfo ai = lookupAnswer(answers, q.subject(), q.number());
            boolean needsReview = !transcribed || q.hasFigure() || ("5지선다".equals(q.type()) && choices.size() < 5);
            return new StructuredMathSheet.ItemSpec(
                    q.number(), prompt, choices, figureUrl,
                    ai != null ? ai.answer() : null,
                    q.points() != null ? q.points() : (ai != null ? ai.points() : null),
                    q.type(),
                    StringUtils.hasText(q.subject()) ? q.subject() : "공통",
                    needsReview);
        } catch (Exception e) {
            log.warn("Transcribe failed (q {}): {}", q.number(), e.getMessage());
            return null;
        }
    }

    private String transcribeSystemPrompt() {
        return """
                You are given a cropped image of ONE Korean 수능 math question (it may contain a figure/graph).
                Transcribe it. Korean prose stays as Korean text; every mathematical expression becomes LaTeX wrapped in $...$.
                Output in EXACTLY this line format (NOT JSON, NO markdown, NO code fences):
                PROMPT: <발문. 문항 번호와 [N점] 표시 제외, 보기 ①~⑤ 제외. 줄바꿈 가능.>
                CHOICE: <보기 ①의 내용>
                CHOICE: <보기 ②의 내용>
                CHOICE: <보기 ③의 내용>
                CHOICE: <보기 ④의 내용>
                CHOICE: <보기 ⑤의 내용>
                Rules:
                - Each CHOICE line = one option, in order, WITHOUT the ①~⑤ marker. If it is a 단답형(short-answer, no ①~⑤), output NO CHOICE lines.
                - Use $...$ for every formula. Backslashes are fine (plain text, not JSON).
                - If there is a figure, keep only the textual statement (the figure is stored separately as an image).
                """;
    }

    /** PROMPT:/CHOICE: 라인 포맷 파싱. JSON을 안 써서 LaTeX 백슬래시에 안전하다. */
    private Transcribed parseTranscription(String content) {
        if (!StringUtils.hasText(content)) return null;
        String body = content.trim();
        if (body.startsWith("```")) {
            body = body.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        StringBuilder prompt = new StringBuilder();
        List<String> choices = new ArrayList<>();
        boolean inPrompt = true; // 라벨이 없어도 앞부분은 발문으로 간주(라벨 누락 케이스 구제)
        for (String line : body.split("\\R")) {
            String trimmed = line.strip();
            if (trimmed.startsWith("PROMPT:")) {
                inPrompt = true;
                prompt.setLength(0); // 라벨을 만나면 그 앞의 군더더기는 버리고 새로 시작
                String rest = trimmed.substring("PROMPT:".length()).strip();
                if (!rest.isEmpty()) prompt.append(rest);
            } else if (trimmed.startsWith("CHOICE:")) {
                inPrompt = false;
                choices.add(trimmed.substring("CHOICE:".length()).strip());
            } else if (inPrompt && !trimmed.isEmpty()) {
                if (prompt.length() > 0) prompt.append(' ');
                prompt.append(trimmed);
            }
        }
        if (prompt.length() == 0 && choices.isEmpty()) return null;
        return new Transcribed(prompt.toString().trim(), choices);
    }

    // ── 정답표 ────────────────────────────────────────────────────────────────
    private Map<String, AnswerInfo> readAnswerKey(byte[] answerBytes) {
        Map<String, AnswerInfo> map = new LinkedHashMap<>();
        try (PDDocument doc = Loader.loadPDF(answerBytes)) {
            ChatClient client = openAiClientResolver.chatClientFor(geminiApiKey, geminiBaseUrl).build();
            PDFRenderer renderer = new PDFRenderer(doc);
            for (int p = 0; p < doc.getNumberOfPages(); p++) {
                byte[] png = pngBytes(scaleToWidth(renderer.renderImageWithDPI(p, RENDER_DPI, ImageType.RGB), DETECT_MAX_WIDTH));
                String content = client.prompt()
                        .options(OpenAiChatOptions.builder().model(geminiModel).maxCompletionTokens(4000))
                        .system(answerSystemPrompt())
                        .user(u -> u.text("Read this answer-key table fully.")
                                .media(MimeTypeUtils.IMAGE_PNG, new ByteArrayResource(png)))
                        .call()
                        .content();
                AnswerList parsed = parseAnswerList(content);
                if (parsed != null && parsed.answers() != null) {
                    for (AnswerRow r : parsed.answers()) {
                        if (r == null || r.number() == null) continue;
                        String subject = StringUtils.hasText(r.subject()) ? r.subject().trim() : "공통";
                        map.put(subject + "|" + r.number(), new AnswerInfo(r.answer(), r.points()));
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Answer-key reading failed: {}", e.getMessage());
        }
        return map;
    }

    private AnswerInfo lookupAnswer(Map<String, AnswerInfo> answers, String subject, Integer number) {
        if (answers.isEmpty() || number == null) return null;
        String subj = StringUtils.hasText(subject) ? subject : "공통";
        AnswerInfo hit = answers.get(subj + "|" + number);
        if (hit == null && number <= 22) hit = answers.get("공통|" + number);
        return hit;
    }

    private String answerSystemPrompt() {
        return """
                This image is the answer-key table (정답표) of a Korean 수능 math exam.
                Columns are grouped: 공통 과목, then 선택 과목 (확률과 통계 / 미적분 / 기하). Each row has 문항번호, 정답, 배점.
                Read EVERY cell across all groups. Return ONLY valid JSON:
                {"answers":[{"subject":"공통","number":1,"answer":"⑤","points":2}]}
                subject ∈ 공통/확률과통계/미적분/기하. answer is ①~⑤ for multiple-choice or an integer string for 단답형.
                """;
    }

    // ── 유틸 ─────────────────────────────────────────────────────────────────
    private int subjectOrder(String s) {
        return switch (s == null ? "" : s) {
            case "공통" -> 0;
            case "확률과통계" -> 1;
            case "미적분" -> 2;
            case "기하" -> 3;
            default -> 9;
        };
    }

    private BufferedImage scaleToWidth(BufferedImage src, int maxWidth) {
        if (src.getWidth() <= maxWidth) return src;
        double scale = (double) maxWidth / src.getWidth();
        int nw = maxWidth, nh = (int) Math.round(src.getHeight() * scale);
        BufferedImage dst = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        var g = dst.createGraphics();
        g.drawImage(src.getScaledInstance(nw, nh, java.awt.Image.SCALE_SMOOTH), 0, 0, null);
        g.dispose();
        return dst;
    }

    private byte[] pngBytes(BufferedImage img) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            return baos.toByteArray();
        } catch (Exception e) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        }
    }

    private AnswerList parseAnswerList(String content) {
        return parse(content, AnswerList.class);
    }

    private <T> T parse(String content, Class<T> type) {
        if (!StringUtils.hasText(content)) return null;
        String json = content.trim();
        if (json.startsWith("```")) {
            json = json.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        int s = json.indexOf('{'), e = json.lastIndexOf('}');
        if (s >= 0 && e > s) json = json.substring(s, e + 1);
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception ex) {
            log.warn("Parse JSON failed: {}", ex.getMessage());
            return null;
        }
    }

    private record Transcribed(String prompt, List<String> choices) {}
    private record AnswerList(List<AnswerRow> answers) {}
    private record AnswerRow(String subject, Integer number, String answer, Integer points) {}
    private record AnswerInfo(String answer, Integer points) {}
}
