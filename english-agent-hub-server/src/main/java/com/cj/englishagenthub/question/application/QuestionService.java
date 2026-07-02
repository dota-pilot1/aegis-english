package com.cj.englishagenthub.question.application;

import com.cj.englishagenthub.category.application.CategoryService;
import com.cj.englishagenthub.category.domain.Category;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import com.cj.englishagenthub.question.presentation.dto.QuestionResponse;
import com.cj.englishagenthub.question.presentation.dto.QuestionUpsertRequest;
import jakarta.persistence.criteria.Predicate;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class QuestionService {

    private final QuestionRepository questionRepository;
    private final CategoryService categoryService;

    @Transactional(readOnly = true)
    public Page<QuestionResponse> list(
            Long categoryId,
            QuestionDifficulty difficulty,
            String keyword,
            Pageable pageable
    ) {
        Set<Long> categoryIds = categoryId == null ? null : categoryService.subtreeIds(categoryId);

        Specification<Question> spec = (root, query, cb) -> {
            List<Predicate> predicates = new ArrayList<>();
            if (categoryIds != null) {
                predicates.add(root.get("category").get("id").in(categoryIds));
            }
            if (difficulty != null) predicates.add(cb.equal(root.get("difficulty"), difficulty));
            if (StringUtils.hasText(keyword)) {
                String pattern = contains(keyword);
                predicates.add(cb.or(
                        cb.like(cb.lower(root.get("question")), pattern),
                        cb.like(cb.lower(root.get("passage")), pattern),
                        cb.like(cb.lower(root.get("answer")), pattern),
                        cb.like(cb.lower(root.get("explanation")), pattern),
                        cb.like(cb.lower(root.get("embeddingText")), pattern)
                ));
            }
            return cb.and(predicates.toArray(Predicate[]::new));
        };

        return questionRepository.findAll(spec, pageable)
                .map(QuestionResponse::from);
    }

    @Transactional(readOnly = true)
    public QuestionResponse get(String id) {
        return QuestionResponse.from(loadOrThrow(id));
    }

    @Transactional
    public QuestionResponse create(QuestionUpsertRequest req) {
        Category category = categoryService.loadOrThrow(req.categoryId());
        Question saved = questionRepository.save(Question.create(
                req.questionType(),
                category,
                req.difficulty(),
                req.question(),
                req.passage(),
                req.choices(),
                req.answer(),
                req.explanation(),
                req.keywords(),
                req.questionKind(),
                req.sourceType(),
                req.sourceName(),
                req.embeddingText()
        ));
        return QuestionResponse.from(saved);
    }

    @Transactional
    public QuestionResponse update(String id, QuestionUpsertRequest req) {
        Question target = loadOrThrow(id);
        Category category = categoryService.loadOrThrow(req.categoryId());
        target.update(
                req.questionType(),
                category,
                req.difficulty(),
                req.question(),
                req.passage(),
                req.choices(),
                req.answer(),
                req.explanation(),
                req.keywords(),
                req.questionKind(),
                req.sourceType(),
                req.sourceName(),
                req.embeddingText()
        );
        return QuestionResponse.from(target);
    }

    @Transactional
    public void delete(String id) {
        Question target = loadOrThrow(id);
        questionRepository.delete(target);
    }

    private Question loadOrThrow(String id) {
        return questionRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.QUESTION_NOT_FOUND));
    }

    private String contains(String value) {
        return "%" + value.trim().toLowerCase() + "%";
    }
}
