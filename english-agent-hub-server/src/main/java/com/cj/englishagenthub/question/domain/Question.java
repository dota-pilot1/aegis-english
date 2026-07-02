package com.cj.englishagenthub.question.domain;

import com.cj.englishagenthub.category.domain.Category;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;
import org.springframework.util.StringUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "questions")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Question {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "category_id", nullable = false)
    private Category category;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private QuestionDifficulty difficulty;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_type", nullable = false, length = 30)
    private QuestionType questionType = QuestionType.SHORT_ANSWER;

    @Enumerated(EnumType.STRING)
    @Column(name = "question_kind", length = 50)
    private QuestionKind questionKind = QuestionKind.GENERAL;

    @Enumerated(EnumType.STRING)
    @Column(name = "source_type", length = 20)
    private QuestionSourceType sourceType = QuestionSourceType.UNKNOWN;

    @Column(name = "source_name", length = 120)
    private String sourceName;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String question;

    @Column(columnDefinition = "TEXT")
    private String passage;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "question_choices", joinColumns = @JoinColumn(name = "question_id"))
    @Column(name = "choice", length = 500)
    private List<String> choices = new ArrayList<>();

    @Column(nullable = false, columnDefinition = "TEXT")
    private String answer;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String explanation;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "question_keywords", joinColumns = @JoinColumn(name = "question_id"))
    @Column(name = "keyword", length = 100)
    private List<String> keywords = new ArrayList<>();

    @Column(nullable = false, columnDefinition = "TEXT")
    private String embeddingText;

    @Column(name = "embedding_text_hash", length = 64)
    private String embeddingTextHash;

    @Enumerated(EnumType.STRING)
    @Column(name = "embedding_status", nullable = false, columnDefinition = "varchar(20)")
    private EmbeddingStatus embeddingStatus = EmbeddingStatus.PENDING;

    @Column(name = "embedding_model", length = 50)
    private String embeddingModel;

    @Column(name = "embedded_at")
    private Instant embeddedAt;

    @Column(name = "embedding_error", columnDefinition = "TEXT")
    private String embeddingError;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static Question create(
            QuestionType questionType,
            Category category,
            QuestionDifficulty difficulty,
            String question,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            List<String> keywords,
            QuestionKind questionKind,
            QuestionSourceType sourceType,
            String sourceName,
            String embeddingText
    ) {
        Question q = new Question();
        q.apply(questionType, category, difficulty, question, passage, choices, answer, explanation, keywords,
                questionKind, sourceType, sourceName, embeddingText);
        return q;
    }

    public void update(
            QuestionType questionType,
            Category category,
            QuestionDifficulty difficulty,
            String question,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            List<String> keywords,
            QuestionKind questionKind,
            QuestionSourceType sourceType,
            String sourceName,
            String embeddingText
    ) {
        apply(questionType, category, difficulty, question, passage, choices, answer, explanation, keywords,
                questionKind, sourceType, sourceName, embeddingText);
    }

    private void apply(
            QuestionType questionType,
            Category category,
            QuestionDifficulty difficulty,
            String question,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            List<String> keywords,
            QuestionKind questionKind,
            QuestionSourceType sourceType,
            String sourceName,
            String embeddingText
    ) {
        List<String> normalizedChoices = normalizeList(choices);
        this.questionType = questionType != null
                ? questionType
                : (normalizedChoices.isEmpty() ? QuestionType.SHORT_ANSWER : QuestionType.MULTIPLE_CHOICE);
        if (this.questionType == QuestionType.SHORT_ANSWER) {
            normalizedChoices = new ArrayList<>();
        } else if (normalizedChoices.size() < 2 || !normalizedChoices.contains(safe(answer))) {
            throw new IllegalArgumentException("객관식 문제는 보기가 2개 이상이고 정답이 보기에 포함되어야 합니다.");
        }
        this.category = category;
        this.difficulty = difficulty;
        this.question = safe(question);
        this.passage = StringUtils.hasText(passage) ? passage.trim() : null;
        this.choices = normalizedChoices;
        this.answer = safe(answer);
        this.explanation = safe(explanation);
        this.keywords = normalizeList(keywords);
        this.questionKind = questionKind == null ? QuestionKind.GENERAL : questionKind;
        this.sourceType = sourceType == null ? QuestionSourceType.UNKNOWN : sourceType;
        this.sourceName = StringUtils.hasText(sourceName) ? sourceName.trim() : null;
        this.embeddingText = StringUtils.hasText(embeddingText)
                ? embeddingText.trim()
                : composeEmbeddingText(categoryPath(category), difficulty, this.questionKind, this.sourceType,
                        this.sourceName, this.question, this.passage, this.answer, this.explanation, this.keywords);
        String newHash = sha256(this.embeddingText);
        if (!newHash.equals(this.embeddingTextHash)) {
            this.embeddingTextHash = newHash;
            this.embeddingStatus = EmbeddingStatus.PENDING;
            this.embeddedAt = null;
            this.embeddingError = null;
        }
    }

    public void markEmbedded(String model) {
        this.embeddingStatus = EmbeddingStatus.COMPLETED;
        this.embeddingModel = model;
        this.embeddedAt = Instant.now();
        this.embeddingError = null;
    }

    public void markFailed(String error) {
        this.embeddingStatus = EmbeddingStatus.FAILED;
        this.embeddingError = error == null ? null : error.substring(0, Math.min(error.length(), 2000));
    }

    private static String sha256(String value) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }

    public static String categoryPath(Category category) {
        return category == null ? "" : String.join(" > ", category.getPathNames());
    }

    public static String composeEmbeddingText(
            String categoryPath,
            QuestionDifficulty difficulty,
            QuestionKind questionKind,
            QuestionSourceType sourceType,
            String sourceName,
            String question,
            String passage,
            String answer,
            String explanation,
            List<String> keywords
    ) {
        return String.join("\n",
                "분류: " + safe(categoryPath),
                "난이도: " + difficultyLabel(difficulty),
                "유형: " + kindLabel(questionKind),
                "출처: " + sourceLabel(sourceType, sourceName),
                "문제: " + safe(question),
                "지문: " + safe(passage),
                "정답: " + safe(answer),
                "해설: " + safe(explanation),
                "키워드: " + String.join(", ", normalizeList(keywords))
        );
    }

    private static List<String> normalizeList(List<String> values) {
        if (values == null) return new ArrayList<>();
        return new ArrayList<>(values.stream()
                .filter(StringUtils::hasText)
                .map(String::trim)
                .distinct()
                .toList());
    }

    private static String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private static String difficultyLabel(QuestionDifficulty difficulty) {
        if (difficulty == null) return "";
        return switch (difficulty) {
            case easy -> "하";
            case medium -> "중";
            case hard -> "상";
        };
    }

    private static String kindLabel(QuestionKind questionKind) {
        if (questionKind == null) return "일반";
        return switch (questionKind) {
            case GENERAL -> "일반";
            case LISTENING_PURPOSE_OPINION -> "듣기 목적/의견";
            case LISTENING_RELATION_PLACE -> "듣기 관계/장소";
            case LISTENING_VISUAL_CHART -> "듣기 그림/도표";
            case LISTENING_TASK_REASON -> "듣기 할 일/이유";
            case LISTENING_DETAIL -> "듣기 내용 일치";
            case LISTENING_LONG_TALK -> "긴 대화/담화";
            case MAIN_IDEA -> "대의 파악";
            case PURPOSE -> "목적";
            case CLAIM -> "주장";
            case GIST -> "요지";
            case TOPIC -> "주제";
            case TITLE -> "제목";
            case DETAIL_CHART -> "도표";
            case DETAIL_MATCH -> "내용 일치";
            case PRACTICAL_TEXT -> "실용문";
            case VOCAB_CONTEXT -> "문맥상 어휘";
            case VOCAB_UNDERLINED -> "밑줄 어휘";
            case GRAMMAR_CHECK -> "어법성 판단";
            case BLANK_WORD -> "단어 빈칸";
            case BLANK_PHRASE -> "구/절 빈칸";
            case BLANK_SENTENCE -> "문장 빈칸";
            case IRRELEVANT_SENTENCE -> "무관한 문장";
            case ORDERING -> "글의 순서";
            case SENTENCE_INSERTION -> "문장 삽입";
            case SUMMARY_COMPLETION -> "요약문 완성";
            case LONG_READING_SET -> "1지문 2문항";
            case COMPOSITE_READING -> "복합 장문";
        };
    }

    private static String sourceLabel(QuestionSourceType sourceType, String sourceName) {
        String type = switch (sourceType == null ? QuestionSourceType.UNKNOWN : sourceType) {
            case UNKNOWN -> "미상";
            case CSAT -> "수능";
            case MOCK -> "모의고사";
            case CUSTOM -> "자체 제작";
        };
        return StringUtils.hasText(sourceName) ? type + " - " + sourceName.trim() : type;
    }
}
