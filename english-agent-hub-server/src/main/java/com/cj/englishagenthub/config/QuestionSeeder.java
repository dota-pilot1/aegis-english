package com.cj.englishagenthub.config;

import com.cj.englishagenthub.category.domain.Category;
import com.cj.englishagenthub.category.infrastructure.CategoryRepository;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.domain.QuestionKind;
import com.cj.englishagenthub.question.domain.QuestionSourceType;
import com.cj.englishagenthub.question.domain.QuestionType;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * MVP 범위: 고등학교 영어·수학만 다룬다.
 * - 영어: 듣기 / 읽기 / 어휘·어법 / 간접 쓰기 / 장문 (수능 운영용 대분류)
 * - 수학: 대수 / 미적분Ⅰ / 확률과 통계 / 기하 (2022 개정 과목)
 * 초등·중학 영어, 한국사, 초등 산수 등 비-고등 데이터는 부팅 시 정리한다.
 */
@Slf4j
@Component
@Order(5)
@RequiredArgsConstructor
public class QuestionSeeder implements ApplicationRunner {

    private final QuestionRepository questionRepository;
    private final CategoryRepository categoryRepository;
    private final JdbcTemplate jdbcTemplate;

    private static final Pattern PROMPT_TO_ENGLISH_PASSAGE = Pattern.compile("[?？]\\s+(?=[A-Z])");

    private static final List<String> ENGLISH_AREAS = List.of("듣기", "읽기", "어휘/어법", "간접 쓰기", "장문");
    private static final List<String> MATH_UNITS = List.of("대수", "미적분Ⅰ", "확률과 통계", "기하");

    /** 이 경로 밖의 카테고리/문제는 모두 정리 대상이다. (루트 + 리프) */
    private static final Set<String> ALLOWED_CATEGORY_PATHS = Set.of(
            "영어",
            "영어 > 듣기",
            "영어 > 읽기",
            "영어 > 어휘/어법",
            "영어 > 간접 쓰기",
            "영어 > 장문",
            "수학",
            "수학 > 대수",
            "수학 > 미적분Ⅰ",
            "수학 > 확률과 통계",
            "수학 > 기하"
    );

    private record QuestionDef(
            List<String> categoryPath,
            QuestionKind questionKind,
            QuestionSourceType sourceType,
            String sourceName,
            QuestionDifficulty difficulty,
            String question,
            String passage,
            List<String> choices,
            String answer,
            String explanation,
            List<String> keywords
    ) {
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        ensureVectorColumn();
        ensureCategoryShape();
        migrateLegacyEnglishCategories();

        List<QuestionDef> seeds = List.of(
                // ── 영어 > 어휘/어법 ─────────────────────────────────────────
                q(List.of("영어", "어휘/어법"), QuestionKind.VOCAB_UNDERLINED, QuestionDifficulty.medium,
                        "밑줄 친 단어와 의미가 가장 가까운 것은? \"diminish\"",
                        choices("decrease", "expand", "maintain", "reveal"), "decrease",
                        "diminish는 줄어들다·감소하다는 뜻으로 decrease와 가장 가깝습니다.",
                        List.of("영어", "어휘", "동의어", "diminish")),
                q(List.of("영어", "어휘/어법"), QuestionKind.VOCAB_CONTEXT, QuestionDifficulty.hard,
                        "빈칸에 들어갈 가장 적절한 단어는? \"The evidence was not enough to ____ his theory.\"",
                        choices("support", "ignore", "destroy", "delay"), "support",
                        "이론을 뒷받침한다는 문맥이므로 support가 적절합니다.",
                        List.of("영어", "어휘", "문맥", "support")),
                q(List.of("영어", "어휘/어법"), QuestionKind.GRAMMAR_CHECK, QuestionDifficulty.hard,
                        "If she ____ harder, she would have passed the exam.",
                        choices("had studied", "studied", "has studied", "studies"), "had studied",
                        "가정법 과거완료이므로 if절에는 had + p.p.를 씁니다.",
                        List.of("영어", "어법", "가정법 과거완료")),
                q(List.of("영어", "어휘/어법"), QuestionKind.GRAMMAR_CHECK, QuestionDifficulty.medium,
                        "The book ____ I borrowed yesterday was very interesting.",
                        choices("that", "who", "whose", "what"), "that",
                        "사물 선행사 the book을 받는 목적격 관계대명사로 that(또는 which)이 적절합니다.",
                        List.of("영어", "어법", "관계대명사")),

                // ── 영어 > 읽기 ──────────────────────────────────────────────
                qPassage(List.of("영어", "읽기"), QuestionKind.MAIN_IDEA, QuestionDifficulty.medium,
                        "What is the main idea of the passage?",
                        "Small daily habits often shape long-term results. Reading a few pages, reviewing notes, or practicing a skill for ten minutes may seem minor, but repeated actions create meaningful progress over time.",
                        List.of("Small repeated habits can lead to progress", "Long books are hard to finish", "People should study only at night", "Ten minutes is never enough to learn"),
                        "Small repeated habits can lead to progress",
                        "작은 습관이 반복되면 장기적인 발전을 만든다는 것이 글의 중심 내용입니다.",
                        List.of("영어", "독해", "main idea", "habit")),
                qPassage(List.of("영어", "읽기"), QuestionKind.BLANK_WORD, QuestionDifficulty.hard,
                        "Choose the best word for the blank.",
                        "Many animals migrate to survive. As winter approaches and food becomes ____, they travel long distances to warmer regions where they can find enough to eat.",
                        List.of("scarce", "abundant", "fresh", "cheap"),
                        "scarce",
                        "겨울이 오면 먹이가 부족해진다는 흐름이므로 scarce(부족한)가 적절합니다.",
                        List.of("영어", "독해", "빈칸추론", "scarce")),

                // ── 영어 > 듣기 ──────────────────────────────────────────────
                qPassage(List.of("영어", "듣기"), QuestionKind.LISTENING_RELATION_PLACE, QuestionDifficulty.medium,
                        "대화를 듣고 두 사람이 만날 장소를 고르시오.",
                        "Woman: The library is too crowded today.\nMan: Then how about the cafe across from the station?\nWoman: Good idea. I'll see you there at three.",
                        List.of("At a cafe", "At the library", "At the station platform", "At school"),
                        "At a cafe",
                        "두 사람은 역 맞은편 카페에서 만나기로 했습니다.",
                        List.of("영어", "듣기", "장소", "cafe")),
                qPassage(List.of("영어", "듣기"), QuestionKind.LISTENING_TASK_REASON, QuestionDifficulty.medium,
                        "대화를 듣고 남자가 주말에 할 일을 고르시오.",
                        "Girl: Are you going hiking this weekend?\nBoy: I'd love to, but I have to finish my science project.\nGirl: That's too bad. Maybe next time.",
                        List.of("Finish his science project", "Go hiking", "Visit his grandmother", "Watch a movie"),
                        "Finish his science project",
                        "남자는 과학 과제를 끝내야 한다고 했습니다.",
                        List.of("영어", "듣기", "할 일", "project")),

                // ── 수학 > 대수 ──────────────────────────────────────────────
                q(List.of("수학", "대수"), QuestionKind.GENERAL, QuestionDifficulty.easy,
                        "log₂ 8의 값은?", choices("3", "2", "4", "8"), "3",
                        "2³ = 8이므로 log₂ 8 = 3입니다.",
                        List.of("수학", "대수", "로그")),
                q(List.of("수학", "대수"), QuestionKind.GENERAL, QuestionDifficulty.medium,
                        "첫째항이 2, 공차가 3인 등차수열의 제5항은?",
                        choices("14", "11", "15", "17"), "14",
                        "aₙ = 2 + (n-1)·3 이므로 a₅ = 2 + 4·3 = 14입니다.",
                        List.of("수학", "대수", "등차수열")),

                // ── 수학 > 미적분Ⅰ ──────────────────────────────────────────
                q(List.of("수학", "미적분Ⅰ"), QuestionKind.GENERAL, QuestionDifficulty.easy,
                        "f(x) = x²일 때 f'(3)의 값은?",
                        choices("6", "9", "3", "8"), "6",
                        "f'(x) = 2x이므로 f'(3) = 6입니다.",
                        List.of("수학", "미적분Ⅰ", "미분")),
                q(List.of("수학", "미적분Ⅰ"), QuestionKind.GENERAL, QuestionDifficulty.medium,
                        "lim(x→2) (x² - 4)/(x - 2)의 값은?",
                        choices("4", "0", "2", "정의되지 않음"), "4",
                        "x²-4 = (x-2)(x+2)이므로 약분하면 x+2, x→2에서 4입니다.",
                        List.of("수학", "미적분Ⅰ", "극한")),

                // ── 수학 > 확률과 통계 ───────────────────────────────────────
                q(List.of("수학", "확률과 통계"), QuestionKind.GENERAL, QuestionDifficulty.easy,
                        "서로 다른 책 3권을 일렬로 배열하는 경우의 수는?",
                        choices("6", "3", "9", "12"), "6",
                        "3! = 3×2×1 = 6입니다.",
                        List.of("수학", "확률과 통계", "순열")),
                q(List.of("수학", "확률과 통계"), QuestionKind.GENERAL, QuestionDifficulty.easy,
                        "주사위 한 개를 던질 때 짝수의 눈이 나올 확률은?",
                        choices("1/2", "1/3", "1/6", "2/3"), "1/2",
                        "짝수는 2,4,6의 3가지이므로 3/6 = 1/2입니다.",
                        List.of("수학", "확률과 통계", "확률")),

                // ── 수학 > 기하 ──────────────────────────────────────────────
                q(List.of("수학", "기하"), QuestionKind.GENERAL, QuestionDifficulty.easy,
                        "두 점 (0, 0)과 (3, 4) 사이의 거리는?",
                        choices("5", "7", "12", "25"), "5",
                        "거리 = √(3² + 4²) = √25 = 5입니다.",
                        List.of("수학", "기하", "두 점 사이의 거리")),
                q(List.of("수학", "기하"), QuestionKind.GENERAL, QuestionDifficulty.medium,
                        "원 x² + y² = 9의 반지름의 길이는?",
                        choices("3", "9", "6", "81"), "3",
                        "x² + y² = r²에서 r² = 9이므로 r = 3입니다.",
                        List.of("수학", "기하", "원의 방정식"))
        );

        int created = 0;
        int updated = 0;
        for (QuestionDef seed : seeds) {
            Category category = ensurePath(seed.categoryPath());
            QuestionType type = (seed.choices() == null || seed.choices().isEmpty())
                    ? QuestionType.SHORT_ANSWER
                    : QuestionType.MULTIPLE_CHOICE;

            Question existing = questionRepository.findFirstByQuestion(seed.question()).orElse(null);
            if (existing != null) {
                if (!Objects.equals(existing.getCategory().getId(), category.getId())
                        || !existing.getQuestion().equals(seed.question())
                        || !Objects.equals(existing.getPassage(), seed.passage())
                        || existing.getQuestionType() != type
                        || existing.getDifficulty() != seed.difficulty()
                        || !existing.getChoices().equals(seed.choices())
                        || !Objects.equals(existing.getAnswer(), seed.answer())
                        || !Objects.equals(existing.getExplanation(), seed.explanation())
                        || !existing.getKeywords().equals(seed.keywords())
                        || existing.getQuestionKind() != seed.questionKind()
                        || existing.getSourceType() != seed.sourceType()
                        || !Objects.equals(existing.getSourceName(), seed.sourceName())) {
                    existing.update(
                            type, category, seed.difficulty(), seed.question(), seed.passage(),
                            seed.choices(), seed.answer(), seed.explanation(), seed.keywords(),
                            seed.questionKind(), seed.sourceType(), seed.sourceName(), null
                    );
                    updated++;
                }
                continue;
            }
            questionRepository.save(Question.create(
                    type, category, seed.difficulty(), seed.question(), seed.passage(),
                    seed.choices(), seed.answer(), seed.explanation(), seed.keywords(),
                    seed.questionKind(), seed.sourceType(), seed.sourceName(), null
            ));
            created++;
        }
        if (created > 0) log.info("Seeded {} questions", created);
        if (updated > 0) log.info("Updated {} seeded questions", updated);

        cleanupUnexpectedCategories();
        backfillQuestionMetadata();
        backfillReadingPassages();
    }

    /**
     * pgvector 확장과 embedding_vector 컬럼은 엔티티에 매핑되지 않은 수동 스키마라
     * ddl-auto가 만들어주지 않는다. 부팅 시 idempotent하게 보장한다.
     */
    private void ensureVectorColumn() {
        jdbcTemplate.execute("CREATE EXTENSION IF NOT EXISTS vector");
        jdbcTemplate.execute("ALTER TABLE questions ADD COLUMN IF NOT EXISTS embedding_vector vector(1536)");
    }

    private void ensureCategoryShape() {
        for (String area : ENGLISH_AREAS) {
            ensurePath(List.of("영어", area));
        }
        for (String unit : MATH_UNITS) {
            ensurePath(List.of("수학", unit));
        }
    }

    private void migrateLegacyEnglishCategories() {
        migrateCategory("영어 > 어휘", List.of("영어", "어휘/어법"));
        migrateCategory("영어 > 어법", List.of("영어", "어휘/어법"));
        migrateCategory("영어 > 독해", List.of("영어", "읽기"));
    }

    private void migrateCategory(String legacyPath, List<String> targetPath) {
        Category legacy = findByPath(legacyPath);
        if (legacy == null) return;
        Category target = ensurePath(targetPath);
        int moved = jdbcTemplate.update(
                "UPDATE questions SET category_id = ? WHERE category_id = ?",
                target.getId(),
                legacy.getId()
        );
        if (moved > 0) log.info("Moved {} questions from {} to {}", moved, legacyPath, String.join(" > ", targetPath));
    }

    private void backfillQuestionMetadata() {
        int updated = 0;
        for (Question question : questionRepository.findAll()) {
            QuestionKind kind = question.getQuestionKind() == null || question.getQuestionKind() == QuestionKind.GENERAL
                    ? inferQuestionKind(question)
                    : question.getQuestionKind();
            QuestionSourceType sourceType = question.getSourceType() == null
                    ? QuestionSourceType.UNKNOWN
                    : question.getSourceType();
            if (question.getQuestionKind() == kind && question.getSourceType() == sourceType) {
                continue;
            }
            question.update(
                    question.getQuestionType(), question.getCategory(), question.getDifficulty(),
                    question.getQuestion(), question.getPassage(), question.getChoices(), question.getAnswer(),
                    question.getExplanation(), question.getKeywords(), kind, sourceType, question.getSourceName(), null
            );
            updated++;
        }
        if (updated > 0) log.info("Backfilled {} question metadata rows", updated);
    }

    private QuestionKind inferQuestionKind(Question question) {
        String path = Question.categoryPath(question.getCategory());
        String text = (question.getQuestion() + " " + String.join(" ", question.getKeywords())).toLowerCase();
        if (path.equals("영어 > 듣기")) {
            if (text.contains("장소") || text.contains("관계")) return QuestionKind.LISTENING_RELATION_PLACE;
            if (text.contains("할 일") || text.contains("이유")) return QuestionKind.LISTENING_TASK_REASON;
            if (text.contains("내용")) return QuestionKind.LISTENING_DETAIL;
            return QuestionKind.LISTENING_PURPOSE_OPINION;
        }
        if (path.equals("영어 > 어휘/어법")) {
            if (text.contains("어법") || text.contains("가정법") || text.contains("관계대명사")) return QuestionKind.GRAMMAR_CHECK;
            if (text.contains("밑줄")) return QuestionKind.VOCAB_UNDERLINED;
            return QuestionKind.VOCAB_CONTEXT;
        }
        if (path.equals("영어 > 읽기")) {
            if (text.contains("blank") || text.contains("빈칸")) return QuestionKind.BLANK_WORD;
            if (text.contains("title") || text.contains("제목")) return QuestionKind.TITLE;
            if (text.contains("topic") || text.contains("주제")) return QuestionKind.TOPIC;
            return QuestionKind.MAIN_IDEA;
        }
        if (path.equals("영어 > 간접 쓰기")) {
            if (text.contains("순서")) return QuestionKind.ORDERING;
            if (text.contains("삽입")) return QuestionKind.SENTENCE_INSERTION;
            if (text.contains("요약")) return QuestionKind.SUMMARY_COMPLETION;
            return QuestionKind.IRRELEVANT_SENTENCE;
        }
        if (path.equals("영어 > 장문")) return QuestionKind.LONG_READING_SET;
        return QuestionKind.GENERAL;
    }

    private void backfillReadingPassages() {
        int updated = 0;
        for (Question question : questionRepository.findAll()) {
            if (hasText(question.getPassage()) || !isReadingQuestion(question)) {
                continue;
            }
            SplitQuestion split = splitQuestion(question.getQuestion());
            if (!hasText(split.passage())) {
                continue;
            }
            question.update(
                    question.getQuestionType(), question.getCategory(), question.getDifficulty(),
                    split.prompt(), split.passage(), question.getChoices(), question.getAnswer(),
                    question.getExplanation(), question.getKeywords(), question.getQuestionKind(),
                    question.getSourceType(), question.getSourceName(), null
            );
            updated++;
        }
        if (updated > 0) log.info("Backfilled {} reading passages", updated);
    }

    /** MVP 허용 경로(영어·수학 고등) 밖의 카테고리와 그 문제를 모두 제거한다. */
    private void cleanupUnexpectedCategories() {
        List<Long> unexpectedCategoryIds = categoryRepository.findAll().stream()
                .filter(category -> !ALLOWED_CATEGORY_PATHS.contains(Question.categoryPath(category)))
                .map(Category::getId)
                .toList();
        if (!unexpectedCategoryIds.isEmpty()) {
            deleteQuestionsInCategories(unexpectedCategoryIds);
        }

        boolean changed;
        do {
            changed = false;
            for (Category category : categoryRepository.findAll()) {
                if (ALLOWED_CATEGORY_PATHS.contains(Question.categoryPath(category))) {
                    continue;
                }
                if (categoryRepository.existsByParent_Id(category.getId()) || questionRepository.existsByCategory_Id(category.getId())) {
                    continue;
                }
                categoryRepository.delete(category);
                categoryRepository.flush();
                changed = true;
                break;
            }
        } while (changed);
    }

    private void deleteQuestionsInCategories(List<Long> categoryIds) {
        String categoryPlaceholders = placeholders(categoryIds.size());
        List<String> questionIds = jdbcTemplate.queryForList(
                "SELECT id FROM questions WHERE category_id IN (" + categoryPlaceholders + ")",
                String.class,
                categoryIds.toArray()
        );
        if (questionIds.isEmpty()) {
            return;
        }

        String questionPlaceholders = placeholders(questionIds.size());
        Object[] args = questionIds.toArray();
        int attemptAnswers = jdbcTemplate.update(
                "DELETE FROM attempt_answers WHERE question_id IN (" + questionPlaceholders + ")", args);
        int examItems = jdbcTemplate.update(
                "DELETE FROM exam_items WHERE question_id IN (" + questionPlaceholders + ")", args);
        jdbcTemplate.update(
                "DELETE FROM question_choices WHERE question_id IN (" + questionPlaceholders + ")", args);
        jdbcTemplate.update(
                "DELETE FROM question_keywords WHERE question_id IN (" + questionPlaceholders + ")", args);
        int questions = jdbcTemplate.update(
                "DELETE FROM questions WHERE id IN (" + questionPlaceholders + ")", args);
        log.info("Removed {} non-highschool questions ({} exam items, {} attempt answers)",
                questions, examItems, attemptAnswers);
    }

    private String placeholders(int count) {
        return String.join(",", java.util.Collections.nCopies(count, "?"));
    }

    private boolean isReadingQuestion(Question question) {
        String path = Question.categoryPath(question.getCategory());
        return path.contains("읽기") || path.contains("듣기") || path.contains("장문");
    }

    private SplitQuestion splitQuestion(String value) {
        if (!hasText(value)) return new SplitQuestion("", "");
        String text = value.trim();
        String[] parts = text.split("\\n\\s*\\n", 2);
        if (parts.length == 2) {
            return new SplitQuestion(parts[0].trim(), parts[1].trim());
        }
        Matcher matcher = PROMPT_TO_ENGLISH_PASSAGE.matcher(text);
        if (matcher.find()) {
            int splitIndex = matcher.start() + 1;
            return new SplitQuestion(text.substring(0, splitIndex).trim(), text.substring(splitIndex).trim());
        }
        return new SplitQuestion(text, "");
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private record SplitQuestion(String prompt, String passage) {
    }

    /** 루트부터 경로를 따라 내려가며 없는 노드는 생성 */
    private Category ensurePath(List<String> path) {
        Category current = null;
        for (String name : path) {
            Long parentId = current == null ? null : current.getId();
            Category found = (parentId == null
                    ? categoryRepository.findFirstByParentIsNullAndName(name)
                    : categoryRepository.findFirstByParent_IdAndName(parentId, name))
                    .orElse(null);
            if (found == null) {
                long siblings = parentId == null
                        ? categoryRepository.countByParentIsNull()
                        : categoryRepository.countByParent_Id(parentId);
                found = categoryRepository.save(Category.create(current, name, (int) siblings));
            }
            current = found;
        }
        return current;
    }

    private Category findByPath(String path) {
        for (Category category : categoryRepository.findAll()) {
            if (Question.categoryPath(category).equals(path)) return category;
        }
        return null;
    }

    private QuestionDef q(
            List<String> categoryPath, QuestionKind questionKind, QuestionDifficulty difficulty, String question,
            List<String> choices, String answer, String explanation, List<String> keywords
    ) {
        return new QuestionDef(categoryPath, questionKind, QuestionSourceType.MOCK, "seed sample",
                difficulty, question, null, choices, answer, explanation, keywords);
    }

    private QuestionDef qPassage(
            List<String> categoryPath, QuestionKind questionKind, QuestionDifficulty difficulty, String question, String passage,
            List<String> choices, String answer, String explanation, List<String> keywords
    ) {
        return new QuestionDef(categoryPath, questionKind, QuestionSourceType.MOCK, "seed sample",
                difficulty, question, passage, choices, answer, explanation, keywords);
    }

    private List<String> choices(String answer, String... distractors) {
        List<String> values = java.util.stream.Stream.concat(
                java.util.stream.Stream.of(answer),
                java.util.Arrays.stream(distractors)
        ).toList();
        int offset = Math.floorMod(answer.hashCode(), values.size());
        return java.util.stream.IntStream.range(0, values.size())
                .mapToObj(i -> values.get((i + offset) % values.size()))
                .toList();
    }
}
