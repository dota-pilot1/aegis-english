package com.cj.englishagenthub.mathextraction.application;

import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.rendering.ImageType;
import org.apache.pdfbox.rendering.PDFRenderer;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.pdfbox.text.TextPosition;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import javax.imageio.ImageIO;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * 수능 수학 시험지 PDF의 '레이아웃'만 좌표로 해석하는 공용 파서.
 * 문항번호·2단 컬럼·문항 영역·도형 밴드를 잡아 문항별 크롭(이미지)과 메타를 돌려준다.
 * 이미지 추출기(A)·정형 추출기(B)가 공통으로 쓰되, A의 기존 코드는 건드리지 않는다.
 */
@Component
@Slf4j
public class MathLayoutParser {

    private static final float RENDER_DPI = 120f;
    private static final float SCALE = RENDER_DPI / 72f;
    private static final int BLANK_PAGE_TEXT_THRESHOLD = 15;
    private static final float PAD_TOP = 11f;
    private static final float PAD_X = 4f;
    private static final float CROP_BOTTOM_PAD = 12f;
    private static final float FOOTER_MARGIN = 34f;
    private static final float HEADER_MARGIN = 42f;
    private static final float FIGURE_GAP = 80f;
    private static final float WORKSPACE_GAP = 100f;
    private static final float DUPLICATE_MARKER_Y_TOLERANCE = 18f;

    private static final Pattern Q_MARKER = Pattern.compile("^(\\d{1,2})\\.");
    private static final Pattern POINTS = Pattern.compile("\\[(\\d)\\s*점\\]");
    private static final String CHOICE_MARKS = "①②③④⑤";

    private static final Map<String, Integer> SUBJECT_ORDER = Map.of(
            "공통", 0, "확률과통계", 1, "미적분", 2, "기하", 3);

    /** 문항 1개의 파싱 결과. questionPng=문항 전체 크롭, figurePng=도형 밴드만(없으면 null). */
    public record ParsedQuestion(
            Integer number, Integer points, String type, String subject,
            String text, boolean hasFigure, boolean choicesComplete,
            byte[] questionPng, byte[] figurePng) {}

    public List<ParsedQuestion> parse(byte[] pdfBytes) {
        if (pdfBytes == null || pdfBytes.length == 0) {
            throw new BusinessException(ErrorCode.EXTRACTION_EMPTY_TEXT);
        }
        List<ParsedQuestion> out = new ArrayList<>();
        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFRenderer renderer = new PDFRenderer(doc);
            int count = doc.getNumberOfPages();
            String currentSubject = null;

            for (int p = 1; p <= count; p++) {
                PDPage page = doc.getPage(p - 1);
                PDRectangle box = page.getCropBox();
                float width = box.getWidth(), height = box.getHeight(), midX = width / 2f;

                List<TextLine> lines = extractLines(doc, p, midX);
                int textLen = lines.stream().mapToInt(l -> l.text().replaceAll("\\s", "").length()).sum();
                if (textLen < BLANK_PAGE_TEXT_THRESHOLD) continue;

                String headerSubject = detectSubjectHeader(lines);
                if (headerSubject != null) currentSubject = headerSubject;

                List<Marker> markers = findMarkers(lines, midX, width, height);
                if (markers.isEmpty()) continue;

                BufferedImage img = renderer.renderImageWithDPI(p - 1, RENDER_DPI, ImageType.RGB);
                float pageContentBottom = height - FOOTER_MARGIN;

                for (Marker m : markers) {
                    float yEnd = nextMarkerY(markers, m, pageContentBottom);
                    float colX0 = (m.column() == 'L') ? PAD_X : midX;
                    float colX1 = (m.column() == 'L') ? midX : width - PAD_X;
                    List<TextLine> regionLines = linesIn(lines, colX0, colX1, m.yTop(), yEnd);
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
                    boolean hasFigure = maxInterGap(contentLines, m.yTop()) > FIGURE_GAP;

                    float cropBottom = Math.min(yEnd, qBottom + CROP_BOTTOM_PAD);
                    float contentX0 = colX0, contentX1 = colX1;
                    if (!contentLines.isEmpty()) {
                        contentX0 = (float) contentLines.stream().mapToDouble(TextLine::x0).min().orElse(colX0);
                        contentX1 = (float) contentLines.stream().mapToDouble(TextLine::x1).max().orElse(colX1);
                    }
                    float cropX0 = Math.max(colX0, contentX0 - PAD_X);
                    float cropX1 = hasFigure ? colX1 : Math.min(colX1, contentX1 + PAD_X);

                    byte[] questionPng = cropToPng(img, cropX0, m.yTop() - PAD_TOP, cropX1, cropBottom);
                    byte[] figurePng = hasFigure ? cropFigureBand(img, contentLines, m.yTop(), cropX0, cropX1) : null;

                    out.add(new ParsedQuestion(m.number(), points, type, subject, text,
                            hasFigure, choicesComplete, questionPng, figurePng));
                }
            }
        } catch (IOException e) {
            log.warn("Failed to parse math PDF layout", e);
            throw new BusinessException(ErrorCode.EXTRACTION_PDF_READ_FAILED);
        }
        return dedupe(out);
    }

    /** 본문 안의 가장 큰 세로 공백(=도형 자리)을 찾아 그 밴드만 잘라낸다. */
    private byte[] cropFigureBand(BufferedImage img, List<TextLine> lines, float yTop, float cropX0, float cropX1) {
        if (lines.size() < 2) return null;
        List<TextLine> sorted = new ArrayList<>(lines);
        sorted.sort(Comparator.comparingDouble(TextLine::yTop));
        float prevBottom = sorted.get(0).yBottom();
        float bandTop = -1, bandBottom = -1, largest = 0;
        for (int i = 1; i < sorted.size(); i++) {
            float gap = sorted.get(i).yTop() - prevBottom;
            if (gap > largest) {
                largest = gap;
                bandTop = prevBottom;
                bandBottom = sorted.get(i).yTop();
            }
            prevBottom = Math.max(prevBottom, sorted.get(i).yBottom());
        }
        if (largest <= FIGURE_GAP || bandTop < 0) return null;
        return cropToPng(img, cropX0, bandTop - 2, cropX1, bandBottom + 2);
    }

    // ── 좌표 유틸 (검증 완료, A와 동일 로직) ──────────────────────────────────
    private List<TextLine> extractLines(PDDocument doc, int pageNo, float midX) throws IOException {
        LineStripper stripper = new LineStripper(midX);
        stripper.setStartPage(pageNo);
        stripper.setEndPage(pageNo);
        stripper.getText(doc);
        return stripper.lines;
    }

    private List<Marker> findMarkers(List<TextLine> lines, float midX, float pageWidth, float pageHeight) {
        List<Marker> markers = new ArrayList<>();
        for (TextLine line : lines) {
            Matcher m = Q_MARKER.matcher(line.text().trim());
            if (!m.find()) continue;
            int num = Integer.parseInt(m.group(1));
            if (num < 1 || num > 30) continue;
            if (line.yTop() < HEADER_MARGIN || line.yTop() > pageHeight - FOOTER_MARGIN) continue;
            char col = line.x0() < midX ? 'L' : 'R';
            markers.add(new Marker(num, col, line.x0(), line.yTop()));
        }
        markers.sort(Comparator.comparing((Marker m) -> m.column())
                .thenComparingDouble(Marker::yTop).thenComparingInt(Marker::number));
        return removeNearbyDuplicateMarkers(markers);
    }

    private List<Marker> removeNearbyDuplicateMarkers(List<Marker> markers) {
        List<Marker> out = new ArrayList<>();
        for (Marker marker : markers) {
            boolean dup = false;
            for (Marker kept : out) {
                if (kept.column() == marker.column() && kept.number() == marker.number()
                        && Math.abs(kept.yTop() - marker.yTop()) <= DUPLICATE_MARKER_Y_TOLERANCE) {
                    dup = true;
                    break;
                }
            }
            if (!dup) out.add(marker);
        }
        return out;
    }

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
            float cx = (l.x0() + l.x1()) / 2f, cy = (l.yTop() + l.yBottom()) / 2f;
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

    private float contentBottomY(List<TextLine> lines, float yTop, float yEnd) {
        float choiceBottom = -1;
        for (TextLine l : lines) {
            if (containsChoice(l.text()) && l.yBottom() > choiceBottom) choiceBottom = l.yBottom();
        }
        if (choiceBottom > 0) return choiceBottom;
        if (lines.isEmpty()) return yEnd;
        List<TextLine> sorted = new ArrayList<>(lines);
        sorted.sort(Comparator.comparingDouble(TextLine::yTop));
        float prevBottom = sorted.get(0).yBottom();
        float largestGap = 0, cutBottom = sorted.get(sorted.size() - 1).yBottom();
        for (int i = 1; i < sorted.size(); i++) {
            float gap = sorted.get(i).yTop() - prevBottom;
            if (gap > largestGap) { largestGap = gap; cutBottom = prevBottom; }
            prevBottom = Math.max(prevBottom, sorted.get(i).yBottom());
        }
        return largestGap > WORKSPACE_GAP ? cutBottom : sorted.get(sorted.size() - 1).yBottom();
    }

    private boolean containsChoice(String t) {
        for (char c : CHOICE_MARKS.toCharArray()) if (t.indexOf(c) >= 0) return true;
        return false;
    }

    private float maxInterGap(List<TextLine> lines, float yTop) {
        List<TextLine> sorted = new ArrayList<>(lines);
        sorted.sort(Comparator.comparingDouble(TextLine::yTop));
        float prev = yTop, max = 0;
        for (TextLine l : sorted) { max = Math.max(max, l.yTop() - prev); prev = Math.max(prev, l.yBottom()); }
        return max;
    }

    private int distinctChoiceCount(String text) {
        int n = 0;
        for (char c : CHOICE_MARKS.toCharArray()) if (text.indexOf(c) >= 0) n++;
        return n;
    }

    private Integer parsePoints(String text) {
        Matcher m = POINTS.matcher(text);
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    private String detectSubjectHeader(List<TextLine> lines) {
        for (TextLine l : lines) {
            String t = l.text().replaceAll("\\s", "");
            if (t.length() > 6) continue;
            if (t.contains("미적분")) return "미적분";
            if (t.contains("기하")) return "기하";
            if (t.contains("확률") || t.contains("통계")) return "확률과통계";
        }
        return null;
    }

    private List<ParsedQuestion> dedupe(List<ParsedQuestion> list) {
        Map<String, ParsedQuestion> best = new LinkedHashMap<>();
        for (ParsedQuestion q : list) {
            String subject = StringUtils.hasText(q.subject()) ? q.subject() : "공통";
            String key = subject + "|" + q.number();
            ParsedQuestion prev = best.get(key);
            if (prev == null || quality(q) > quality(prev)) best.put(key, q);
        }
        List<ParsedQuestion> out = new ArrayList<>(best.values());
        out.sort(Comparator
                .comparingInt((ParsedQuestion q) -> SUBJECT_ORDER.getOrDefault(q.subject(), 9))
                .thenComparing(q -> q.number() == null ? Integer.MAX_VALUE : q.number()));
        return out;
    }

    private int quality(ParsedQuestion q) {
        int t = Math.min(400, q.text() == null ? 0 : q.text().replaceAll("\\s", "").length());
        int c = distinctChoiceCount(q.text() == null ? "" : q.text()) * 120;
        int pt = q.points() != null ? 60 : 0;
        return t + c + pt;
    }

    private byte[] cropToPng(BufferedImage page, float x0pt, float y0pt, float x1pt, float y1pt) {
        int w = page.getWidth(), h = page.getHeight();
        int x0 = clamp(Math.round(x0pt * SCALE), 0, w - 1);
        int y0 = clamp(Math.round(y0pt * SCALE), 0, h - 1);
        int x1 = clamp(Math.round(x1pt * SCALE), x0 + 1, w);
        int y1 = clamp(Math.round(y1pt * SCALE), y0 + 1, h);
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            ImageIO.write(page.getSubimage(x0, y0, x1 - x0, y1 - y0), "png", baos);
            return baos.toByteArray();
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.MATH_EXTRACTION_NONE);
        }
    }

    private int clamp(int v, int lo, int hi) {
        return Math.max(lo, Math.min(hi, v));
    }

    private static class LineStripper extends PDFTextStripper {
        final List<TextLine> lines = new ArrayList<>();
        private final float midX;

        LineStripper(float midX) throws IOException {
            super();
            this.midX = midX;
            setSortByPosition(true);
        }

        @Override
        protected void writeString(String string, List<TextPosition> textPositions) {
            if (textPositions.isEmpty()) return;
            emit(textPositions, Float.NEGATIVE_INFINITY, midX);
            emit(textPositions, midX, Float.POSITIVE_INFINITY);
        }

        private void emit(List<TextPosition> tps, float lo, float hi) {
            StringBuilder sb = new StringBuilder();
            float minX = Float.MAX_VALUE, minY = Float.MAX_VALUE, maxX = -1, maxY = -1, prevEnd = -1;
            for (TextPosition tp : tps) {
                float x0 = tp.getXDirAdj();
                if (x0 < lo || x0 >= hi) continue;
                float x1 = x0 + tp.getWidthDirAdj();
                if (prevEnd >= 0 && x0 - prevEnd > 3f) sb.append(' ');
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

    private record TextLine(String text, float x0, float yTop, float x1, float yBottom) {}

    private record Marker(int number, char column, float x0, float yTop) {}
}
