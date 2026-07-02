package com.cj.englishagenthub.question.application;

import com.cj.englishagenthub.ai.infrastructure.OpenAiClientResolver;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.domain.QuestionSourceType;
import com.cj.englishagenthub.question.domain.QuestionType;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import com.cj.englishagenthub.question.presentation.dto.GenerateSimilarReadingQuestionRequest;
import com.cj.englishagenthub.question.presentation.dto.QuestionUpsertRequest;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionGenerationService {

    private final QuestionRepository questionRepository;
    private final OpenAiClientResolver openAiClientResolver;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openai.question-generation.model:${openai.translation.model:gpt-5-mini}}")
    private String generationModel;

    @Transactional(readOnly = true)
    public List<QuestionUpsertRequest> generateSimilarReadingQuestions(
            String sourceQuestionId,
            GenerateSimilarReadingQuestionRequest request
    ) {
        Question source = questionRepository.findById(sourceQuestionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.QUESTION_NOT_FOUND));
        SourceQuestion sourceQuestion = SourceQuestion.from(source);
        return generateSimilarReadingQuestions(sourceQuestion, request);
    }

    @Transactional(readOnly = true)
    public List<QuestionUpsertRequest> generateSimilarReadingQuestions(GenerateSimilarReadingQuestionRequest request) {
        SourceQuestion sourceQuestion = SourceQuestion.from(request);
        return generateSimilarReadingQuestions(sourceQuestion, request);
    }

    private List<QuestionUpsertRequest> generateSimilarReadingQuestions(
            SourceQuestion source,
            GenerateSimilarReadingQuestionRequest request
    ) {
        if (!openAiClientResolver.hasUsableKey()) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }
        QuestionDifficulty difficulty = request.resolvedDifficulty(source.difficulty());

        ChatClient.Builder builder = openAiClientResolver.resolveChatClientBuilder();
        if (builder == null) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }

        int candidateCount = Math.min(8, Math.max(request.count() * 2, request.count() + 2));
        String content = builder.build()
                .prompt()
                .options(OpenAiChatOptions.builder()
                        .model(generationModel)
                        .reasoningEffort("minimal")
                        .verbosity("low")
                        .maxCompletionTokens(3500))
                .system(systemPrompt())
                .user(userPrompt(source, request, difficulty, candidateCount))
                .call()
                .content();

        GeneratedQuestionList parsed = parse(content);
        if (parsed == null || parsed.questions() == null || parsed.questions().isEmpty()) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
        log.info("Generated {} reading candidates for template {}", parsed.questions().size(), request.templateId());

        List<QuestionUpsertRequest> generated = parsed.questions().stream()
                .filter(item -> isValidGeneratedQuestion(item, source, request.choiceCount()))
                .map(item -> toUpsertRequest(item, source, difficulty, request.choiceCount()))
                .limit(request.count())
                .toList();
        if (generated.isEmpty()) {
            log.warn("No generated reading candidates passed validation. template={}, raw={}", request.templateId(), content);
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
        return generated;
    }

    /**
     * 출처 문항 1개와 유형(객관식/주관식)·난이도·측정 능력이 같은 새 문항 1개를 생성한다.
     * reading 템플릿에 묶이지 않는 범용 버전으로, 시험지 통째 변형(ExamVariant)에서 사용한다.
     * 원문을 그대로 베끼지 않도록 프롬프트와 검증에서 강제한다.
     */
    @Transactional(readOnly = true)
    public QuestionUpsertRequest generateOneSimilar(Question source) {
        if (!openAiClientResolver.hasUsableKey()) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }
        ChatClient.Builder builder = openAiClientResolver.resolveChatClientBuilder();
        if (builder == null) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }

        boolean isMultipleChoice = source.getQuestionType() == QuestionType.MULTIPLE_CHOICE;
        int choiceCount = isMultipleChoice ? Math.max(2, source.getChoices().size()) : 0;
        boolean hasPassage = StringUtils.hasText(source.getPassage());

        String content = builder.build()
                .prompt()
                .options(OpenAiChatOptions.builder()
                        .model(generationModel)
                        .reasoningEffort("minimal")
                        .verbosity("low")
                        .maxCompletionTokens(2500))
                .system(genericSystemPrompt())
                .user(genericUserPrompt(source, isMultipleChoice, hasPassage, choiceCount))
                .call()
                .content();

        GeneratedQuestionList parsed = parse(content);
        if (parsed == null || parsed.questions() == null || parsed.questions().isEmpty()) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
        return toGenericUpsert(parsed.questions().get(0), source, isMultipleChoice, hasPassage, choiceCount);
    }

    private QuestionUpsertRequest toGenericUpsert(
            GeneratedQuestion item,
            Question source,
            boolean isMultipleChoice,
            boolean hasPassage,
            int choiceCount
    ) {
        String question = item.prompt();
        if (!StringUtils.hasText(question)) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
        String passage = hasPassage ? item.readingPassage() : null;
        String explanation = StringUtils.hasText(item.explanation())
                ? item.explanation().trim()
                : "해설은 검수 단계에서 입력하세요.";
        List<String> keywords = normalize(item.keywords());
        Long categoryId = source.getCategory().getId();
        QuestionDifficulty difficulty = source.getDifficulty();

        if (isMultipleChoice) {
            List<String> choices = fitChoices(normalize(item.choices()), safe(item.answer()), choiceCount);
            String answer = safe(item.answer());
            if (choices.size() != choiceCount || !choices.contains(answer)) {
                throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
            }
            return new QuestionUpsertRequest(
                    QuestionType.MULTIPLE_CHOICE, source.getQuestionKind(), QuestionSourceType.CUSTOM, "AI 유사 문제", categoryId, difficulty,
                    question, passage, choices, answer, explanation, keywords, null
            );
        }

        String answer = safe(item.answer());
        if (!StringUtils.hasText(answer)) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
        return new QuestionUpsertRequest(
                QuestionType.SHORT_ANSWER, source.getQuestionKind(), QuestionSourceType.CUSTOM, "AI 유사 문제", categoryId, difficulty,
                question, passage, List.of(), answer, explanation, keywords, null
        );
    }

    private String genericSystemPrompt() {
        return """
                You generate ONE new English exam question for Korean learners that is similar to a source question
                in its tested skill, question type, and difficulty — but is NOT a copy of it.
                Return only valid JSON. Do not wrap the JSON in markdown.
                JSON schema:
                {
                  "questions": [
                    {
                      "question": "Korean question prompt (and English material such as a word or sentence when the source has it)",
                      "passage": "English reading passage, or empty string if the source has none",
                      "choices": ["choice1", "choice2", "..."],
                      "answer": "one exact value from choices (multiple choice) or the correct short answer",
                      "explanation": "brief Korean explanation",
                      "keywords": ["영어", "..."]
                    }
                  ]
                }
                """;
    }

    private String genericUserPrompt(Question source, boolean isMultipleChoice, boolean hasPassage, int choiceCount) {
        return """
                Generate ONE new question similar to the source.

                Source:
                type: %s
                category: %s
                difficulty: %s
                question: %s
                passage: %s
                choices: %s
                answer: %s
                keywords: %s

                Constraints:
                - Keep the same question type (%s), category, and difficulty (%s).
                - Keep the SAME tested skill (e.g. vocabulary meaning, grammar point, reading inference).
                - Do NOT copy the source question, passage, choices, or answer verbatim. Change the concrete word/sentence/topic.
                %s
                %s
                - Put the Korean prompt (and any English material) in "question".
                - Write the explanation in Korean.
                - Make the new question clearly answerable and unambiguous.
                """.formatted(
                source.getQuestionType(),
                Question.categoryPath(source.getCategory()),
                source.getDifficulty(),
                safe(source.getQuestion()),
                hasPassage ? safe(source.getPassage()) : "(none)",
                isMultipleChoice ? normalize(source.getChoices()) : "(none)",
                safe(source.getAnswer()),
                normalize(source.getKeywords()),
                source.getQuestionType(),
                source.getDifficulty(),
                isMultipleChoice
                        ? "- Provide exactly " + choiceCount + " unique choices; the answer must be exactly one of them; distractors must be newly written and plausible."
                        : "- This is a short-answer question: leave \"choices\" empty and give the correct answer in \"answer\".",
                hasPassage
                        ? "- Provide a NEW English passage of similar length and style in \"passage\"."
                        : "- Leave \"passage\" empty."
        );
    }

    private QuestionUpsertRequest toUpsertRequest(
            GeneratedQuestion item,
            SourceQuestion source,
            QuestionDifficulty difficulty,
            int choiceCount
    ) {
        List<String> choices = fitChoices(normalize(item.choices()), safe(item.answer()), choiceCount);
        String answer = safe(item.answer());
        if (choices.size() != choiceCount || !choices.contains(answer)) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
        // 생성 문제는 LLM이 직접 출제하므로 해설을 항상 채운다(자기 출제라 신뢰도 높음).
        String explanation = StringUtils.hasText(item.explanation())
                ? item.explanation().trim()
                : "해설은 검수 단계에서 입력하세요.";

        return new QuestionUpsertRequest(
                QuestionType.MULTIPLE_CHOICE,
                null,
                QuestionSourceType.CUSTOM,
                "AI 유사 문제",
                source.categoryId(),
                difficulty,
                item.prompt(),
                item.readingPassage(),
                choices,
                answer,
                explanation,
                normalize(item.keywords()),
                null
        );
    }

    private String systemPrompt() {
        return """
                You generate English reading-comprehension multiple-choice questions for Korean learners.
                You must follow the provided template rules exactly.
                Return only valid JSON. Do not wrap the JSON in markdown.
                JSON schema:
                {
                  "questions": [
                    {
                      "question": "Korean question prompt only",
                      "passage": "English reading passage only",
                      "choices": ["choice1", "choice2", "choice3", "choice4"],
                      "answer": "one exact value from choices",
                      "explanation": "brief Korean explanation",
                      "keywords": ["영어", "독해", "..."]
                    }
                  ]
                }
                """;
    }

    private String userPrompt(
            SourceQuestion source,
            GenerateSimilarReadingQuestionRequest request,
            QuestionDifficulty difficulty,
            int candidateCount
    ) {
        return """
                Generate %d similar reading questions.

                Source question:
                category: %s
                difficulty: %s
                question:
                %s
                passage:
                %s
                choices: %s
                answer: %s
                explanation: %s
                keywords: %s

                Template:
                id: %s
                title: %s
                subtype: %s
                rules:
                %s

                Generation constraints:
                - Keep category and difficulty level: %s.
                - Use exactly %d choices per question.
                - The English passage must be 4 to 6 sentences long unless the template rule says otherwise.
                - Put only the Korean question prompt in "question".
                - Put only the English reading passage in "passage".
                - The answer must be exactly one of the choices.
                - Never return the source question itself as a generated question.
                - Do not copy source passage sentences verbatim.
                - Do not reuse the source passage with only changed choices.
                - Do not copy source choices verbatim.
                - Do not reuse two or more source distractors.
                - All choices within a generated question must be unique.
                - Distractors must be newly written and plausible for the new passage.
                - %s
                - %s
                - Always explain why the answer is correct in Korean (1-2 sentences), in "explanation".
                - Make every generated question mutually distinct.
                """.formatted(
                candidateCount,
                source.categoryPath(),
                source.difficulty(),
                source.question(),
                source.passage(),
                source.choices(),
                source.answer(),
                source.explanation(),
                source.keywords(),
                request.templateId(),
                request.templateTitle(),
                request.subtype(),
                String.join("\n", request.rules() == null ? List.of() : request.rules()),
                difficulty,
                request.choiceCount(),
                request.keepTopic() ? "Keep the broad learning topic similar to the source, but use new wording and a new passage." : "Use a different learning topic if needed.",
                request.avoidDuplicate() ? "Avoid semantic duplication with the source question and existing source choices." : "Minor topical overlap is allowed."
        );
    }

    private boolean isValidGeneratedQuestion(GeneratedQuestion item, SourceQuestion source, int choiceCount) {
        List<String> generatedChoices = normalize(item.choices()).stream().map(this::normalizeText).toList();
        if (generatedChoices.size() < choiceCount || generatedChoices.stream().distinct().count() != generatedChoices.size()) {
            return false;
        }

        String generatedAnswer = normalizeText(item.answer());
        if (!generatedChoices.contains(generatedAnswer)) {
            return false;
        }

        String generatedQuestion = normalizeText(item.prompt());
        if (!StringUtils.hasText(generatedQuestion) || generatedQuestion.contains("\n")) {
            return false;
        }
        String sourceQuestion = normalizeText(source.question());
        if (generatedQuestion.equals(sourceQuestion)) {
            return false;
        }

        String generatedPassage = normalizeText(item.readingPassage());
        if (!StringUtils.hasText(generatedPassage)) {
            return false;
        }
        String sourcePassage = normalizeText(source.passage());
        if (StringUtils.hasText(generatedPassage) && generatedPassage.equals(sourcePassage)) {
            return false;
        }

        List<String> sourceChoices = normalize(source.choices()).stream().map(this::normalizeText).toList();
        long sameChoiceCount = generatedChoices.stream().filter(sourceChoices::contains).count();
        if (generatedChoices.size() >= 2 && sameChoiceCount == generatedChoices.size()) {
            return false;
        }

        return true;
    }

    private List<String> fitChoices(List<String> choices, String answer, int choiceCount) {
        if (choices.size() <= choiceCount) {
            return choices;
        }
        List<String> fitted = new java.util.ArrayList<>();
        if (choices.contains(answer)) {
            fitted.add(answer);
        }
        for (String choice : choices) {
            if (fitted.size() >= choiceCount) break;
            if (!choice.equals(answer)) fitted.add(choice);
        }
        return fitted.stream().distinct().limit(choiceCount).toList();
    }

    private String normalizeText(String value) {
        if (value == null) return "";
        return value
                .replaceAll("\\s+", " ")
                .replaceAll("[“”]", "\"")
                .replaceAll("[‘’]", "'")
                .trim()
                .toLowerCase();
    }

    private SplitQuestion splitQuestion(String value) {
        if (!StringUtils.hasText(value)) return new SplitQuestion("", "");
        String text = value.trim();
        String[] parts = text.split("\\n\\s*\\n", 2);
        if (parts.length == 2) {
            return new SplitQuestion(parts[0].trim(), parts[1].trim());
        }
        int boundary = text.indexOf("? ");
        if (boundary < 0) boundary = text.indexOf("？ ");
        if (boundary >= 0 && boundary + 2 < text.length() && Character.isUpperCase(text.charAt(boundary + 2))) {
            return new SplitQuestion(text.substring(0, boundary + 1).trim(), text.substring(boundary + 2).trim());
        }
        return new SplitQuestion(text, "");
    }

    private GeneratedQuestionList parse(String content) {
        if (!StringUtils.hasText(content)) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
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
            return objectMapper.readValue(json, GeneratedQuestionList.class);
        } catch (JsonProcessingException e) {
            log.error("Failed to parse generated question JSON. raw={}", content, e);
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
    }

    private List<String> normalize(List<String> values) {
        if (values == null) return List.of();
        return values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private record GeneratedQuestionList(List<GeneratedQuestion> questions) {
    }

    private record SourceQuestion(
            Long categoryId,
            String categoryPath,
            QuestionDifficulty difficulty,
            String question,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            List<String> keywords
    ) {
        static SourceQuestion from(Question source) {
            return new SourceQuestion(
                    source.getCategory().getId(),
                    Question.categoryPath(source.getCategory()),
                    source.getDifficulty(),
                    source.getQuestion(),
                    source.getPassage(),
                    source.getChoices(),
                    source.getAnswer(),
                    source.getExplanation(),
                    source.getKeywords()
            );
        }

        static SourceQuestion from(GenerateSimilarReadingQuestionRequest request) {
            if (request.categoryId() == null || !StringUtils.hasText(request.sourceQuestion())) {
                throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
            }
            return new SourceQuestion(
                    request.categoryId(),
                    request.categoryPath(),
                    request.sourceDifficulty() == null ? QuestionDifficulty.medium : request.sourceDifficulty(),
                    request.sourceQuestion(),
                    request.sourcePassage(),
                    request.sourceChoices(),
                    request.sourceAnswer(),
                    request.sourceExplanation(),
                    request.sourceKeywords()
            );
        }
    }

    private record GeneratedQuestion(
            String question,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            List<String> keywords
    ) {
        String prompt() {
            return splitFromQuestion().prompt();
        }

        String readingPassage() {
            return StringUtils.hasText(passage) ? passage.trim() : splitFromQuestion().passage();
        }

        private SplitQuestion splitFromQuestion() {
            if (!StringUtils.hasText(question)) return new SplitQuestion("", "");
            String text = question.trim();
            String[] parts = text.split("\\n\\s*\\n", 2);
            if (parts.length == 2) {
                return new SplitQuestion(parts[0].trim(), parts[1].trim());
            }
            int boundary = text.indexOf("? ");
            if (boundary < 0) boundary = text.indexOf("？ ");
            if (boundary >= 0 && boundary + 2 < text.length() && Character.isUpperCase(text.charAt(boundary + 2))) {
                return new SplitQuestion(text.substring(0, boundary + 1).trim(), text.substring(boundary + 2).trim());
            }
            return new SplitQuestion(text, "");
        }
    }

    private record SplitQuestion(String prompt, String passage) {
    }
}
