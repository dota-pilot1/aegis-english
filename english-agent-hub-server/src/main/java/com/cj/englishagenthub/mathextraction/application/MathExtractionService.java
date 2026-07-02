package com.cj.englishagenthub.mathextraction.application;

import com.cj.englishagenthub.ai.infrastructure.OpenAiClientResolver;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.common.upload.UploadService;
import com.cj.englishagenthub.mathextraction.domain.ExtractedMathSheet;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeTypeUtils;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.Graphics2D;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 수학 PDF에서 문항을 '이미지'로 추출한다 (좌표 기반).
 * 수식이 텍스트로는 깨지므로, 텍스트 레이어에서 멀쩡히 나오는 문항번호·보기·배점의 '위치'만 활용한다:
 * 번호 마커 위치로 문항 영역을 정하고, 그 영역을 원본 렌더 이미지에서 잘라낸다(머리글 자동 제외).
 * 텍스트(한글 발문)는 검색·검수용으로 같이 저장하고, 수식/도형/보기누락 문항은 검수 플래그를 단다.
 * Vision은 이미지 기반인 정답표를 읽을 때만 쓴다.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MathExtractionService {

    private final OpenAiClientResolver openAiClientResolver;
    private final UploadService uploadService;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    /** 크롭 품질용 렌더 DPI. 표시엔 120이면 충분(컬럼 폭 ~700px)하고 150보다 렌더가 빠르다. */
    private static final float RENDER_DPI = 120f;
    private static final float SCALE = RENDER_DPI / 72f;
    /** 정답표 Vision 감지용 이미지 최대 가로 픽셀. */
    private static final int DETECT_MAX_WIDTH = 1600;
    /** S3 업로드 동시 처리 수. */
    private static final int UPLOAD_CONCURRENCY = 6;
    /** 이 글자 수 미만 페이지는 빈/스캔 페이지로 보고 건너뜀. */
    private static final int BLANK_PAGE_TEXT_THRESHOLD = 15;
    /** 크롭 시 위/좌우 여백(pt). */
    private static final float PAD_TOP = 11f;
    private static final float PAD_X = 4f;
    /** 하단 타이트 크롭 시 마지막 줄 아래 여백(pt). */
    private static final float CROP_BOTTOM_PAD = 12f;
    /** 푸터(쪽번호·저작권) 잘라낼 하단 여백(pt). 수능 수학은 마지막 문항 번호가 하단에 가까운 페이지가 있다. */
    private static final float FOOTER_MARGIN = 12f;
    /** 본문(보기까지) 안에 이 정도 세로 공백(pt)이 있으면 도형이 있다고 본다. */
    private static final float FIGURE_GAP = 80f;
    /** 단답형에서 이보다 큰 세로 공백은 '풀이공간'으로 보고 그 직전까지만 자른다. */
    private static final float WORKSPACE_GAP = 100f;
    /** 머리글/꼬리글 영역에서 검출된 숫자는 문항 번호로 보지 않는다. */
    private static final float HEADER_MARGIN = 42f;
    /** 같은 컬럼에서 거의 같은 위치의 동일 번호는 하나만 남긴다. */
    private static final float DUPLICATE_MARKER_Y_TOLERANCE = 18f;

    private static final Pattern Q_MARKER = Pattern.compile("^(\\d{1,2})(?:\\.|\\s*$)");
    private static final Pattern POINTS = Pattern.compile("\\[(\\d)\\s*점\\]");
    private static final String CHOICE_MARKS = "①②③④⑤";

    private static final Map<String, Integer> SUBJECT_ORDER = Map.of(
            "공통", 0, "확률과통계", 1, "미적분", 2, "기하", 3);

    @Value("${gemini.api-key:}")
    private String geminiApiKey;

    @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta/openai}")
    private String geminiBaseUrl;

    @Value("${gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    public List<ExtractedMathSheet.ItemSpec> extract(MultipartFile problemPdf, MultipartFile answerPdf) {
        long t0 = System.currentTimeMillis();

        // 정답표 Vision 읽기는 문제 파싱과 독립적 → 미리 비동기로 띄워 겹친다.
        boolean hasAnswer = answerPdf != null && !answerPdf.isEmpty() && StringUtils.hasText(geminiApiKey);
        byte[] answerBytes = readBytesOrNull(answerPdf, hasAnswer);
        CompletableFuture<Map<String, AnswerInfo>> answerFuture = (answerBytes != null)
                ? CompletableFuture.supplyAsync(() -> readAnswerKey(answerBytes))
                : CompletableFuture.completedFuture(Map.of());

        // Phase 1: PDF를 좌표 기반으로 훑어 문항별 크롭 바이트 + 메타 생성(문서 단일 스레드).
        List<Pending> pending = parseProblem(problemPdf);
        long t1 = System.currentTimeMillis();
        if (pending.isEmpty()) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        }

        // Phase 2: 정답 매핑 결과 수거(이미 백그라운드에서 진행됨).
        Map<String, AnswerInfo> answers = Map.of();
        try {
            answers = answerFuture.get();
        } catch (Exception e) {
            log.warn("Answer-key future failed: {}", e.getMessage());
        }
        final Map<String, AnswerInfo> answerMap = answers;
        long t2 = System.currentTimeMillis();

        // Phase 3: 크롭 이미지를 S3에 병렬 업로드 → ItemSpec.
        List<ExtractedMathSheet.ItemSpec> specs = java.util.Collections.synchronizedList(new ArrayList<>());
        ExecutorService pool = Executors.newFixedThreadPool(Math.min(UPLOAD_CONCURRENCY, Math.max(1, pending.size())));
        try {
            List<CompletableFuture<Void>> futures = new ArrayList<>();
            for (Pending p : pending) {
                futures.add(CompletableFuture.runAsync(() -> {
                    try {
                        String url = uploadService.putBytes(p.png(), "image/png", "math-extracted",
                                "q-" + UUID.randomUUID() + ".png");
                        AnswerInfo ai = lookupAnswer(answerMap, p.subject(), p.number());
                        specs.add(new ExtractedMathSheet.ItemSpec(
                                p.number(), url,
                                p.points() != null ? p.points() : (ai != null ? ai.points() : null),
                                p.type(),
                                ai != null ? ai.answer() : null,
                                p.subject(), p.text(), p.hasFigure(), p.needsReview()
                        ));
                    } catch (Exception e) {
                        log.warn("Upload failed (q {}): {}", p.number(), e.getMessage());
                    }
                }, pool));
            }
            for (CompletableFuture<Void> f : futures) {
                try { f.get(); } catch (Exception ignored) {}
            }
        } finally {
            pool.shutdown();
        }

        if (specs.isEmpty()) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        }
        specs.sort(Comparator
                .comparingInt((ExtractedMathSheet.ItemSpec s) -> SUBJECT_ORDER.getOrDefault(s.subject(), 9))
                .thenComparing(s -> s.questionNumber() == null ? Integer.MAX_VALUE : s.questionNumber()));
        long t3 = System.currentTimeMillis();
        log.info("Extracted {} math questions from {} — parse {}ms, answer-wait {}ms, upload {}ms, total {}ms",
                specs.size(), problemPdf.getOriginalFilename(),
                (t1 - t0), (t2 - t1), (t3 - t2), (t3 - t0));
        return specs;
    }

    private byte[] readBytesOrNull(MultipartFile file, boolean enabled) {
        if (!enabled) return null;
        try {
            return file.getBytes();
        } catch (IOException e) {
            log.warn("Failed to read answer PDF bytes: {}", e.getMessage());
            return null;
        }
    }

    // ── Phase 1: 좌표 기반 파싱 ───────────────────────────────────────────────
    private List<Pending> parseProblem(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.EXTRACTION_EMPTY_TEXT);
        }
        List<Pending> out = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(file.getBytes())) {
            PDFRenderer renderer = new PDFRenderer(doc);
            int count = doc.getNumberOfPages();
            String currentSubject = null; // 선택과목 섹션 헤더를 만나면 갱신(이후 23~30에 적용)

            for (int p = 1; p <= count; p++) {
                PDPage page = doc.getPage(p - 1);
                PDRectangle box = page.getCropBox();
                float width = box.getWidth();
                float height = box.getHeight();
                float midX = width / 2f;

                List<TextLine> lines = extractLines(doc, p, midX);
                int textLen = lines.stream().mapToInt(l -> l.text().replaceAll("\\s", "").length()).sum();
                if (textLen < BLANK_PAGE_TEXT_THRESHOLD) continue; // 빈/스캔 페이지

                String headerSubject = detectSubjectHeader(lines);
                if (headerSubject != null) currentSubject = headerSubject;

                List<Marker> markers = findMarkers(lines, midX, width, height);
                log.info("math parse page {} — textLen={}, lines={}, markers={}", p, textLen, lines.size(), markers.size());
                if (markers.isEmpty()) continue;

                BufferedImage img = renderer.renderImageWithDPI(p - 1, RENDER_DPI, ImageType.RGB);
                float contentBottom = height - FOOTER_MARGIN;

                for (Marker m : markers) {
                    float yEnd = nextMarkerY(markers, m, contentBottom);
                    float colX0 = (m.column() == 'L') ? PAD_X : midX;
                    float colX1 = (m.column() == 'L') ? midX : width - PAD_X;
                    List<TextLine> regionLines = linesIn(lines, colX0, colX1, m.yTop(), yEnd);
                    // 문항의 시각적 끝: 보기(①~⑤)가 있으면 마지막 보기 줄, 없으면(단답형) 본문 클러스터 끝.
                    // 빈 풀이공간에 흩어진 깨진 수식 조각을 제외하기 위해 여기까지만 '내용'으로 본다.
                    float qBottom = contentBottomY(regionLines, m.yTop(), yEnd);
                    List<TextLine> contentLines = new ArrayList<>();
                    for (TextLine l : regionLines) if (l.yTop() < qBottom) contentLines.add(l);

                    String text = joinText(contentLines);
                    int choiceCount = distinctChoiceCount(text);
                    boolean isMultipleChoice = choiceCount > 0;
                    boolean choicesComplete = choiceCount >= 5;
                    String type = isMultipleChoice ? "5지선다" : "단답형";
                    Integer points = parsePoints(text);
                    String subject = m.number() <= 22 ? "공통"
                            : (currentSubject != null ? currentSubject : "공통");
                    // 도형: 본문(보기까지) 안에서 큰 세로 공백 = 그림 자리.
                    boolean hasFigure = maxInterGap(contentLines, m.yTop()) > FIGURE_GAP;
                    boolean needsReview = hasFigure || (isMultipleChoice && !choicesComplete);

                    float cropBottom = Math.min(yEnd, qBottom + CROP_BOTTOM_PAD);
                    // 가로도 내용에 맞춰 타이트하게: 시험지 좌측 인쇄 여백을 잘라낸다.
                    // 좌단은 항상 내용(번호) 왼쪽, 우단은 도형이 텍스트보다 넓을 수 있어 도형 문항이면 컬럼 끝까지.
                    float contentX0 = colX0, contentX1 = colX1;
                    if (!contentLines.isEmpty()) {
                        contentX0 = (float) contentLines.stream().mapToDouble(TextLine::x0).min().orElse(colX0);
                        contentX1 = (float) contentLines.stream().mapToDouble(TextLine::x1).max().orElse(colX1);
                    }
                    float cropX0 = Math.max(colX0, contentX0 - PAD_X);
                    float cropX1 = hasFigure ? colX1 : Math.min(colX1, contentX1 + PAD_X);
                    byte[] png = cropToPng(img, cropX0, m.yTop() - PAD_TOP, cropX1, cropBottom);
                    out.add(new Pending(m.number(), points, type, subject, text, hasFigure, needsReview, png));
                }
            }
        } catch (IOException e) {
            log.warn("Failed to parse math PDF {}", file.getOriginalFilename(), e);
            throw new BusinessException(ErrorCode.EXTRACTION_PDF_READ_FAILED);
        }
        return dedupePending(out);
    }

    /** 한 페이지의 텍스트를 줄 단위(텍스트+bbox, top-left 원점, pt)로 추출. */
    private List<TextLine> extractLines(PDDocument doc, int pageNo, float midX) throws IOException {
        LineStripper stripper = new LineStripper(midX);
        stripper.setStartPage(pageNo);
        stripper.setEndPage(pageNo);
        stripper.getText(doc);
        return stripper.lines;
    }

    /** 문항 번호 마커(줄 시작이 "N.")를 컬럼과 함께 추출. */
    private List<Marker> findMarkers(List<TextLine> lines, float midX, float pageWidth, float pageHeight) {
        List<Marker> markers = new ArrayList<>();
        for (TextLine line : lines) {
            Matcher m = Q_MARKER.matcher(line.text().trim());
            if (!m.find()) continue;
            int num = Integer.parseInt(m.group(1));
            if (num < 1 || num > 30) continue;
            char col = line.x0() < midX ? 'L' : 'R';
            if (!isPlausibleQuestionMarker(line, col, midX, pageWidth, pageHeight)) continue;
            markers.add(new Marker(num, col, line.x0(), line.yTop()));
        }
        markers.sort(Comparator
                .comparing((Marker m) -> m.column())
                .thenComparingDouble(Marker::yTop)
                .thenComparingInt(Marker::number));
        markers = removeNearbyDuplicateMarkers(markers);
        return markers;
    }

    private boolean isPlausibleQuestionMarker(TextLine line, char column, float midX, float pageWidth, float pageHeight) {
        if (line.yTop() < HEADER_MARGIN || line.yTop() > pageHeight - FOOTER_MARGIN) return false;
        String t = line.text().trim();
        int dot = t.indexOf('.');
        return dot > 0 || t.matches("\\d{1,2}");
    }

    private List<Marker> removeNearbyDuplicateMarkers(List<Marker> markers) {
        List<Marker> out = new ArrayList<>();
        for (Marker marker : markers) {
            boolean duplicate = false;
            for (Marker kept : out) {
                if (kept.column() == marker.column()
                        && kept.number() == marker.number()
                        && Math.abs(kept.yTop() - marker.yTop()) <= DUPLICATE_MARKER_Y_TOLERANCE) {
                    duplicate = true;
                    break;
                }
            }
            if (!duplicate) out.add(marker);
        }
        return out;
    }

    /** 같은 컬럼에서 yTop 바로 아래 다음 마커의 y(없으면 contentBottom). */
    private float nextMarkerY(List<Marker> markers, Marker cur, float contentBottom) {
        float best = contentBottom;
        for (Marker m : markers) {
            if (m.column() != cur.column()) continue;
            if (m.yTop() > cur.yTop() + 1 && m.yTop() < best) best = m.yTop();
        }
        return best;
    }

    private List<TextLine> linesIn(List<TextLine> lines, float x0, float x1, float yTop, float yBottom) {
        List<TextLine> out = new ArrayList<>();
        for (TextLine l : lines) {
            float cx = (l.x0() + l.x1()) / 2f;
            float cy = (l.yTop() + l.yBottom()) / 2f;
            if (cx >= x0 && cx < x1 && cy >= yTop - 2 && cy < yBottom) out.add(l);
        }
        out.sort(Comparator.comparingDouble(TextLine::yTop));
        return out;
    }

    private String joinText(List<TextLine> lines) {
        StringBuilder sb = new StringBuilder();
        for (TextLine l : lines) {
            String t = l.text().trim();
            if (!t.isEmpty()) sb.append(t).append('\n');
        }
        return sb.toString().trim();
    }

    /** 문항의 시각적 끝 y. 보기(①~⑤) 줄이 있으면 그 마지막 줄, 없으면 본문 클러스터(큰 공백 전)의 끝. */
    private float contentBottomY(List<TextLine> lines, float yTop, float yEnd) {
        float choiceBottom = -1;
        for (TextLine l : lines) {
            if (containsChoice(l.text()) && l.yBottom() > choiceBottom) choiceBottom = l.yBottom();
        }
        if (choiceBottom > 0) return choiceBottom;
        // 단답형: 보기가 없으니 '가장 큰 세로 공백'(=풀이공간) 직전까지를 내용으로 본다.
        // 그 공백이 풀이공간 크기일 때만 자르고, 아니면(내용이 연속) 마지막 줄까지 둔다. 도형 공백은 풀이공간보다 작아 보존된다.
        if (lines.isEmpty()) return yEnd;
        List<TextLine> sorted = new ArrayList<>(lines);
        sorted.sort(Comparator.comparingDouble(TextLine::yTop));
        float prevBottom = sorted.get(0).yBottom();
        float largestGap = 0;
        float cutBottom = sorted.get(sorted.size() - 1).yBottom();
        for (int i = 1; i < sorted.size(); i++) {
            float gap = sorted.get(i).yTop() - prevBottom;
            if (gap > largestGap) {
                largestGap = gap;
                cutBottom = prevBottom;
            }
            prevBottom = Math.max(prevBottom, sorted.get(i).yBottom());
        }
        return largestGap > WORKSPACE_GAP ? cutBottom : sorted.get(sorted.size() - 1).yBottom();
    }

    private boolean containsChoice(String t) {
        for (char c : CHOICE_MARKS.toCharArray()) if (t.indexOf(c) >= 0) return true;
        return false;
    }

    /** 줄 사이 최대 세로 공백(도형 추정용). */
    private float maxInterGap(List<TextLine> lines, float yTop) {
        List<TextLine> sorted = new ArrayList<>(lines);
        sorted.sort(Comparator.comparingDouble(TextLine::yTop));
        float prev = yTop, max = 0;
        for (TextLine l : sorted) {
            max = Math.max(max, l.yTop() - prev);
            prev = Math.max(prev, l.yBottom());
        }
        return max;
    }

    private int distinctChoiceCount(String text) {
        int n = 0;
        for (char c : CHOICE_MARKS.toCharArray()) {
            if (text.indexOf(c) >= 0) n++;
        }
        return n;
    }

    private Integer parsePoints(String text) {
        Matcher m = POINTS.matcher(text);
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    private List<Pending> dedupePending(List<Pending> pending) {
        Map<String, Pending> bestByQuestion = new LinkedHashMap<>();
        for (Pending p : pending) {
            String key = key(p.subject(), p.number());
            Pending previous = bestByQuestion.get(key);
            if (previous == null || pendingQuality(p) > pendingQuality(previous)) {
                bestByQuestion.put(key, p);
            }
        }
        return new ArrayList<>(bestByQuestion.values());
    }

    private int pendingQuality(Pending p) {
        String text = p.text() == null ? "" : p.text();
        int textScore = Math.min(400, text.replaceAll("\\s", "").length());
        int choiceScore = distinctChoiceCount(text) * 120;
        int pointScore = p.points() != null ? 60 : 0;
        int reviewPenalty = p.needsReview() ? 30 : 0;
        return textScore + choiceScore + pointScore - reviewPenalty;
    }

    /** 선택과목 섹션 헤더 감지. 컬럼 분리로 "확률과 통계"가 쪼개질 수 있어 짧은 줄에서 부분 일치로 본다. */
    private String detectSubjectHeader(List<TextLine> lines) {
        for (TextLine l : lines) {
            String t = l.text().replaceAll("\\s", "");
            if (t.length() > 6) continue; // 헤더는 짧다(문항 본문 오탐 방지)
            if (t.contains("미적분")) return "미적분";
            if (t.contains("기하")) return "기하";
            if (t.contains("확률") || t.contains("통계")) return "확률과통계";
        }
        return null;
    }

    // ── 이미지 유틸 ───────────────────────────────────────────────────────────
    private byte[] cropToPng(BufferedImage page, float x0pt, float y0pt, float x1pt, float y1pt) {
        int w = page.getWidth(), h = page.getHeight();
        int x0 = clamp(Math.round(x0pt * SCALE), 0, w - 1);
        int y0 = clamp(Math.round(y0pt * SCALE), 0, h - 1);
        int x1 = clamp(Math.round(x1pt * SCALE), x0 + 1, w);
        int y1 = clamp(Math.round(y1pt * SCALE), y0 + 1, h);
        return pngBytes(page.getSubimage(x0, y0, x1 - x0, y1 - y0));
    }

    private BufferedImage scaleToWidth(BufferedImage src, int maxWidth) {
        if (src.getWidth() <= maxWidth) return src;
        double scale = (double) maxWidth / src.getWidth();
        int nw = maxWidth, nh = (int) Math.round(src.getHeight() * scale);
        BufferedImage dst = new BufferedImage(nw, nh, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = dst.createGraphics();
        g.drawImage(src.getScaledInstance(nw, nh, java.awt.Image.SCALE_SMOOTH), 0, 0, null);
        g.dispose();
        return dst;
    }

    private byte[] pngBytes(BufferedImage img) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(img, "png", baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        }
    }

    private int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    // ── 정답표 Vision 읽기 ────────────────────────────────────────────────────
    private Map<String, AnswerInfo> readAnswerKey(byte[] answerPdfBytes) {
        Map<String, AnswerInfo> map = new LinkedHashMap<>();
        try (PDDocument doc = Loader.loadPDF(answerPdfBytes)) {
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
                AnswerList parsed = parseQuiet(content, AnswerList.class, p + 1);
                if (parsed != null && parsed.answers() != null) {
                    for (AnswerRow r : parsed.answers()) {
                        if (r == null || r.number() == null) continue;
                        String subject = StringUtils.hasText(r.subject()) ? r.subject().trim() : "공통";
                        map.put(key(subject, r.number()), new AnswerInfo(r.answer(), r.points()));
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
        AnswerInfo hit = answers.get(key(subj, number));
        if (hit == null && number <= 22) hit = answers.get(key("공통", number));
        return hit;
    }

    private String key(String subject, int number) {
        return subject + "|" + number;
    }

    private <T> T parseQuiet(String content, Class<T> type, int pageNo) {
        if (!StringUtils.hasText(content)) return null;
        String json = content.trim();
        if (json.startsWith("```")) {
            json = json.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start >= 0 && end > start) json = json.substring(start, end + 1);
        try {
            return objectMapper.readValue(json, type);
        } catch (Exception e) {
            log.warn("Failed to parse answer JSON (page {}): {}", pageNo, e.getMessage());
            return null;
        }
    }

    private String answerSystemPrompt() {
        return """
                This image is the answer-key table (정답표) of a Korean 수능 math exam.
                Columns are grouped: 공통 과목, then 선택 과목 (확률과 통계 / 미적분 / 기하). Each row has 문항번호, 정답, 배점.
                Read EVERY cell across all groups.
                Return ONLY valid JSON, no markdown:
                {"answers":[{"subject":"공통","number":1,"answer":"⑤","points":2},{"subject":"미적분","number":29,"answer":"25","points":4}]}
                - subject is one of 공통 / 확률과통계 / 미적분 / 기하.
                - answer is one of ①②③④⑤ for multiple-choice rows, or the integer string for 단답형 rows.
                """;
    }

    // ── PDFBox 위치 텍스트 스트리퍼 ───────────────────────────────────────────
    /** writeString마다 줄의 텍스트와 bbox(top-left 원점, pt)를 모은다. */
    private static class LineStripper extends PDFTextStripper {
        final List<TextLine> lines = new ArrayList<>();
        private final float midX; // 좌/우 컬럼 경계. PDFBox가 두 컬럼을 한 줄로 합쳐도 여기서 다시 가른다.

        LineStripper(float midX) throws IOException {
            super();
            this.midX = midX;
            setSortByPosition(true);
        }

        @Override
        protected void writeString(String string, List<TextPosition> textPositions) {
            if (textPositions.isEmpty()) return;
            emit(textPositions, Float.NEGATIVE_INFINITY, midX); // 왼쪽 컬럼
            emit(textPositions, midX, Float.POSITIVE_INFINITY); // 오른쪽 컬럼
        }

        /** [lo, hi) x범위 안의 글자만으로 줄을 재구성해 담는다. */
        private void emit(List<TextPosition> tps, float lo, float hi) {
            StringBuilder sb = new StringBuilder();
            float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE, maxX = -1, maxY = -1, prevEnd = -1;
            for (TextPosition tp : tps) {
                float x0 = tp.getXDirAdj();
                if (x0 < lo || x0 >= hi) continue;
                float x1 = x0 + tp.getWidthDirAdj();
                if (prevEnd >= 0 && x0 - prevEnd > 3f) sb.append(' '); // 큰 가로 공백은 토큰 분리
                sb.append(tp.getUnicode());
                prevEnd = x1;
                float yBottom = tp.getYDirAdj();
                float yTop = yBottom - tp.getHeightDir();
                if (x0 < minX) minX = x0;
                if (x1 > maxX) maxX = x1;
                if (yTop < minY) minY = yTop;
                if (yBottom > maxY) maxY = yBottom;
            }
            if (sb.toString().trim().isEmpty()) return;
            lines.add(new TextLine(sb.toString(), minX, minY, maxX, maxY));
        }
    }

    // ── 레코드 ────────────────────────────────────────────────────────────────
    private record TextLine(String text, float x0, float yTop, float x1, float yBottom) {}

    private record Marker(int number, char column, float x0, float yTop) {}

    private record Pending(Integer number, Integer points, String type, String subject,
                           String text, boolean hasFigure, boolean needsReview, byte[] png) {}

    private record AnswerList(List<AnswerRow> answers) {}

    private record AnswerRow(String subject, Integer number, String answer, Integer points) {}

    private record AnswerInfo(String answer, Integer points) {}
}
