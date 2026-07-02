package com.cj.englishagenthub.question.application;

import com.cj.englishagenthub.ai.infrastructure.OpenAiClientResolver;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.question.presentation.dto.ExtractedQuestionResponse;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 시험지 PDF에서 독해(읽기) 문항만 추출한다.
 * - Gemini 키가 있으면: 1M 컨텍스트로 시험지 전체를 단일 호출(안정·저렴). 권장.
 * - 없으면: OpenAI로 페이지 단위 청크 추출(출력 잘림 방지)로 폴백.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionExtractionService {

    private final OpenAiClientResolver openAiClientResolver;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openai.question-generation.model:${openai.translation.model:gpt-5-mini}}")
    private String openAiModel;

    @Value("${gemini.api-key:}")
    private String geminiApiKey;

    @Value("${gemini.base-url:https://generativelanguage.googleapis.com/v1beta/openai}")
    private String geminiBaseUrl;

    @Value("${gemini.model:gemini-2.5-flash}")
    private String geminiModel;

    public List<ExtractedQuestionResponse> extractReadingQuestions(MultipartFile file) {
        List<String> pages = extractPdfPages(file);
        if (pages.stream().noneMatch(StringUtils::hasText)) {
            throw new BusinessException(ErrorCode.EXTRACTION_EMPTY_TEXT);
        }

        List<ExtractedQuestion> merged = StringUtils.hasText(geminiApiKey)
                ? extractWithGemini(pages)
                : extractWithOpenAiPerPage(pages);

        List<ExtractedQuestionResponse> result = merged.stream()
                .map(q -> new ExtractedQuestionResponse(
                        q.number(),
                        q.prompt() == null ? "" : q.prompt().trim(),
                        q.passage() == null ? null : q.passage().trim(),
                        normalize(q.choices()),
                        resolveAnswer(q),
                        q.explanation() == null ? null : q.explanation().trim(),
                        "읽기"
                ))
                .toList();
        if (result.isEmpty()) {
            throw new BusinessException(ErrorCode.EXTRACTION_NO_READING);
        }

        List<Integer> numbers = result.stream().map(ExtractedQuestionResponse::number).filter(n -> n != null).toList();
        log.info("Extracted {} reading questions from {} via {} — numbers: {}",
                result.size(), file.getOriginalFilename(),
                StringUtils.hasText(geminiApiKey) ? "gemini" : "openai", numbers);
        return result;
    }

    // ── Gemini: 페이지 단위 '병렬' 호출 ────────────────────────────────────
    // 한 번에 통짜로 뽑으면 출력이 커서 느리고(프록시 타임아웃), 청크를 순차로 돌리면 합산이 길다.
    // 페이지를 동시에 호출해 wall-clock을 최단으로 줄인다.
    private List<ExtractedQuestion> extractWithGemini(List<String> pages) {
        ChatClient client = openAiClientResolver.chatClientFor(geminiApiKey, geminiBaseUrl).build();
        int concurrency = Math.min(5, Math.max(1, pages.size()));
        ExecutorService pool = Executors.newFixedThreadPool(concurrency);
        try {
            List<CompletableFuture<List<ExtractedQuestion>>> futures = new ArrayList<>();
            for (int i = 0; i < pages.size(); i++) {
                String pageText = pages.get(i);
                if (!StringUtils.hasText(pageText)) continue;
                int pageNo = i + 1;
                futures.add(CompletableFuture.supplyAsync(
                        () -> extractPage(client, geminiModel, pageText, pageNo), pool));
            }
            List<ExtractedQuestion> all = new ArrayList<>();
            for (CompletableFuture<List<ExtractedQuestion>> f : futures) {
                try {
                    all.addAll(f.get());
                } catch (Exception e) {
                    log.warn("Gemini page extraction failed: {}", e.getMessage());
                }
            }
            return dedup(all);
        } finally {
            pool.shutdown();
        }
    }

    private List<ExtractedQuestion> extractPage(ChatClient client, String model, String pageText, int pageNo) {
        String content = client.prompt()
                .options(OpenAiChatOptions.builder().model(model).maxCompletionTokens(8000))
                .system(pageSystemPrompt())
                .user(pageUserPrompt(pageText, pageNo))
                .call()
                .content();
        ExtractedList parsed = parseQuiet(content, pageNo);
        return (parsed != null && parsed.questions() != null) ? parsed.questions() : List.of();
    }

    // ── OpenAI: 페이지 단위 청크 추출(폴백) ─────────────────────────────────
    private List<ExtractedQuestion> extractWithOpenAiPerPage(List<String> pages) {
        if (!openAiClientResolver.hasUsableKey()) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }
        ChatClient.Builder builder = openAiClientResolver.resolveChatClientBuilder();
        if (builder == null) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }
        ChatClient client = builder.build();

        List<ExtractedQuestion> all = new ArrayList<>();
        for (int i = 0; i < pages.size(); i++) {
            String pageText = pages.get(i);
            if (!StringUtils.hasText(pageText)) continue;
            String content;
            try {
                content = client.prompt()
                        .options(OpenAiChatOptions.builder()
                                .model(openAiModel)
                                .reasoningEffort("low")
                                .maxCompletionTokens(8000))
                        .system(pageSystemPrompt())
                        .user(pageUserPrompt(pageText, i + 1))
                        .call()
                        .content();
            } catch (Exception e) {
                log.warn("OpenAI extraction failed on page {}: {}", i + 1, e.getMessage());
                continue;
            }
            ExtractedList parsed = parseQuiet(content, i + 1);
            if (parsed != null && parsed.questions() != null) {
                all.addAll(parsed.questions());
            }
        }
        return dedup(all);
    }

    /** 사용 가능 문항만, 번호로 dedup(먼저 본 것 우선), 번호 오름차순(번호 없는 건 뒤). */
    private List<ExtractedQuestion> dedup(List<ExtractedQuestion> questions) {
        Map<Integer, ExtractedQuestion> byNumber = new LinkedHashMap<>();
        List<ExtractedQuestion> withoutNumber = new ArrayList<>();
        for (ExtractedQuestion q : questions) {
            if (!isUsable(q)) continue;
            if (q.number() != null) {
                byNumber.putIfAbsent(q.number(), q);
            } else {
                withoutNumber.add(q);
            }
        }
        List<ExtractedQuestion> merged = new ArrayList<>(byNumber.values());
        merged.addAll(withoutNumber);
        merged.sort(Comparator.comparing(q -> q.number() == null ? Integer.MAX_VALUE : q.number()));
        return merged;
    }

    /** 페이지별 텍스트. 인덱스 = 0-based 페이지. */
    private List<String> extractPdfPages(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessException(ErrorCode.EXTRACTION_EMPTY_TEXT);
        }
        try (PDDocument document = Loader.loadPDF(file.getBytes())) {
            PDFTextStripper stripper = new PDFTextStripper();
            stripper.setSortByPosition(true);
            int pageCount = document.getNumberOfPages();
            List<String> pages = new ArrayList<>(pageCount);
            for (int p = 1; p <= pageCount; p++) {
                stripper.setStartPage(p);
                stripper.setEndPage(p);
                pages.add(stripper.getText(document));
            }
            return pages;
        } catch (IOException e) {
            log.warn("Failed to read PDF text from {}", file.getOriginalFilename(), e);
            throw new BusinessException(ErrorCode.EXTRACTION_PDF_READ_FAILED);
        }
    }

    /** LLM이 준 정답을 보기 중 하나와 매칭해 정확한 보기 문자열로 정규화한다. */
    private String resolveAnswer(ExtractedQuestion q) {
        if (q.choices() == null || !StringUtils.hasText(q.answer())) return null;
        String ans = q.answer().trim();
        List<String> choices = normalize(q.choices());
        for (String c : choices) {
            if (c.equalsIgnoreCase(ans)) return c;
        }
        for (String c : choices) {
            if (c.replaceAll("\\s", "").equalsIgnoreCase(ans.replaceAll("\\s", ""))) return c;
        }
        Integer idx = markerIndex(ans);
        if (idx != null && idx >= 1 && idx <= choices.size()) return choices.get(idx - 1);
        for (String c : choices) {
            if (c.toLowerCase().contains(ans.toLowerCase())) return c;
        }
        return ans;
    }

    private Integer markerIndex(String s) {
        String t = s.trim();
        if (t.isEmpty()) return null;
        int m = "①②③④⑤".indexOf(t.charAt(0));
        if (m >= 0) return m + 1;
        if (t.charAt(0) >= '1' && t.charAt(0) <= '5') return t.charAt(0) - '0';
        return null;
    }

    private boolean isUsable(ExtractedQuestion q) {
        return StringUtils.hasText(q.prompt())
                && q.choices() != null
                && q.choices().stream().filter(StringUtils::hasText).count() >= 2;
    }

    private String pageSystemPrompt() {
        return """
                You extract reading-comprehension questions from ONE page of a Korean high-school English exam (수능/모의고사).
                Rules:
                - Extract EVERY reading question on this page. Do not skip any.
                - EXCLUDE listening questions: any whose Korean prompt contains 듣고/대화를 듣고/다음을 듣고/방송.
                - Keep the English passage verbatim, or "" if none on this page.
                - A question must include its choices (보기 ①~⑤). Include what is present even if partly cut off.
                - SOLVE each question yourself: "answer" = the full text of the correct choice (exactly as in "choices"); "explanation" = brief Korean reason (1-2 sentences).
                Return only valid JSON, no markdown:
                {
                  "questions": [
                    { "number": 21, "prompt": "한국어 발문", "passage": "English passage verbatim or \\"\\"", "choices": ["①...","②...","③...","④...","⑤..."], "answer": "정답 보기 전체 문자열", "explanation": "한국어 해설" }
                  ]
                }
                If this page has no reading question, return {"questions": []}.
                """;
    }

    private String pageUserPrompt(String pageText, int pageNo) {
        return """
                This is page %d. Extract all reading questions on it.

                === PAGE TEXT START ===
                %s
                === PAGE TEXT END ===
                """.formatted(pageNo, pageText);
    }

    /** 파싱 실패가 전체를 막지 않도록 throw 대신 null 반환. */
    private ExtractedList parseQuiet(String content, int pageNo) {
        if (!StringUtils.hasText(content)) return null;
        String json = content.trim();
        if (json.startsWith("```")) {
            json = json.replaceAll("^```[a-zA-Z]*\\s*", "").replaceAll("\\s*```$", "").trim();
        }
        int start = json.indexOf('{');
        int end = json.lastIndexOf('}');
        if (start >= 0 && end > start) {
            json = json.substring(start, end + 1);
        }
        try {
            return objectMapper.readValue(json, ExtractedList.class);
        } catch (Exception e) {
            log.warn("Failed to parse extracted JSON (page {}): {}", pageNo, e.getMessage());
            return null;
        }
    }

    private List<String> normalize(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .toList();
    }

    private record ExtractedList(List<ExtractedQuestion> questions) {
    }

    private record ExtractedQuestion(Integer number, String prompt, String passage, List<String> choices,
                                     String answer, String explanation) {
    }
}
