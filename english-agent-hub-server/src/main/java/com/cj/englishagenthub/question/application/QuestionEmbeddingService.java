package com.cj.englishagenthub.question.application;

import com.cj.englishagenthub.category.application.CategoryService;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.question.domain.EmbeddingStatus;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.infrastructure.QuestionRepository;
import com.cj.englishagenthub.question.presentation.dto.QuestionResponse;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.ai.embedding.EmbeddingModel;
import org.springframework.ai.embedding.EmbeddingResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Slf4j
public class QuestionEmbeddingService {

    private final QuestionRepository questionRepository;
    private final EmbeddingModel embeddingModel;
    private final EntityManager entityManager;
    private final CategoryService categoryService;

    @Value("${spring.ai.openai.embedding.options.model:text-embedding-3-small}")
    private String embeddingModelName;

    public record EmbeddingBatchResult(int picked, int completed, int failed, long stillPending) {}

    public record EmbeddingCounts(long pending, long completed, long failed) {}

    public record SimilarQuestion(QuestionResponse question, double similarity) {}

    @Transactional(readOnly = true)
    public List<SimilarQuestion> findSimilar(String id, int limit) {
        Question source = questionRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.QUESTION_NOT_FOUND));
        if (source.getEmbeddingStatus() != EmbeddingStatus.COMPLETED) {
            throw new BusinessException(ErrorCode.QUESTION_NOT_EMBEDDED);
        }

        int safeLimit = Math.max(1, Math.min(limit, 20));

        @SuppressWarnings("unchecked")
        List<Object[]> rows = entityManager.createNativeQuery("""
                SELECT id, 1 - (embedding_vector <=> (SELECT embedding_vector FROM questions WHERE id = :id)) AS similarity
                FROM questions
                WHERE id <> :id AND embedding_vector IS NOT NULL
                ORDER BY embedding_vector <=> (SELECT embedding_vector FROM questions WHERE id = :id)
                LIMIT :limit
                """)
                .setParameter("id", id)
                .setParameter("limit", safeLimit)
                .getResultList();

        if (rows.isEmpty()) return List.of();

        List<String> orderedIds = rows.stream().map(r -> (String) r[0]).toList();
        Map<String, Double> scoreById = new HashMap<>();
        for (Object[] row : rows) {
            scoreById.put((String) row[0], ((Number) row[1]).doubleValue());
        }

        Map<String, Question> byId = new HashMap<>();
        for (Question q : questionRepository.findAllById(orderedIds)) byId.put(q.getId(), q);

        return orderedIds.stream()
                .map(qid -> new SimilarQuestion(QuestionResponse.from(byId.get(qid)), scoreById.get(qid)))
                .toList();
    }

    public long countPending() {
        return pendingCount(null);
    }

    private long pendingCount(Set<Long> categoryIds) {
        if (categoryIds == null) {
            return questionRepository.countByEmbeddingStatus(EmbeddingStatus.PENDING)
                    + questionRepository.countByEmbeddingStatus(EmbeddingStatus.FAILED);
        }
        return questionRepository.countByEmbeddingStatusAndCategory_IdIn(EmbeddingStatus.PENDING, categoryIds)
                + questionRepository.countByEmbeddingStatusAndCategory_IdIn(EmbeddingStatus.FAILED, categoryIds);
    }

    private long countStatus(EmbeddingStatus status, Set<Long> categoryIds) {
        return categoryIds == null
                ? questionRepository.countByEmbeddingStatus(status)
                : questionRepository.countByEmbeddingStatusAndCategory_IdIn(status, categoryIds);
    }

    @Transactional(readOnly = true)
    public EmbeddingCounts counts() {
        return counts(null);
    }

    @Transactional(readOnly = true)
    public EmbeddingCounts counts(Long categoryId) {
        Set<Long> categoryIds = categoryId == null ? null : categoryService.subtreeIds(categoryId);
        return new EmbeddingCounts(
                countStatus(EmbeddingStatus.PENDING, categoryIds),
                countStatus(EmbeddingStatus.COMPLETED, categoryIds),
                countStatus(EmbeddingStatus.FAILED, categoryIds)
        );
    }

    @Transactional
    public QuestionResponse embedOne(String id) {
        Question q = questionRepository.findById(id)
                .orElseThrow(() -> new BusinessException(ErrorCode.QUESTION_NOT_FOUND));
        try {
            EmbeddingResponse response = embeddingModel.embedForResponse(List.of(q.getEmbeddingText()));
            float[] vector = response.getResults().get(0).getOutput();
            entityManager.createNativeQuery(
                            "UPDATE questions SET embedding_vector = CAST(:v AS vector) WHERE id = :id")
                    .setParameter("v", toVectorLiteral(vector))
                    .setParameter("id", q.getId())
                    .executeUpdate();
            q.markEmbedded(embeddingModelName);
        } catch (Exception e) {
            log.error("Single embedding failed for {}", id, e);
            q.markFailed(e.getMessage());
        }
        return QuestionResponse.from(q);
    }

    @Transactional
    public EmbeddingBatchResult embedPending(int limit) {
        return embedPending(null, limit);
    }

    @Transactional
    public EmbeddingBatchResult embedPending(Long categoryId, int limit) {
        Set<Long> categoryIds = categoryId == null ? null : categoryService.subtreeIds(categoryId);
        int safeLimit = Math.max(1, Math.min(limit, 200));
        List<Question> targets = categoryIds == null
                ? questionRepository.findByEmbeddingStatusInOrderByCreatedAtAsc(
                        List.of(EmbeddingStatus.PENDING, EmbeddingStatus.FAILED),
                        PageRequest.of(0, safeLimit))
                : questionRepository.findByEmbeddingStatusInAndCategory_IdInOrderByCreatedAtAsc(
                        List.of(EmbeddingStatus.PENDING, EmbeddingStatus.FAILED),
                        categoryIds,
                        PageRequest.of(0, safeLimit));
        if (targets.isEmpty()) {
            return new EmbeddingBatchResult(0, 0, 0, 0);
        }

        List<String> texts = targets.stream().map(Question::getEmbeddingText).toList();

        EmbeddingResponse response;
        try {
            response = embeddingModel.embedForResponse(texts);
        } catch (Exception e) {
            log.error("Embedding batch failed for {} questions", targets.size(), e);
            String msg = e.getMessage();
            for (Question q : targets) q.markFailed(msg);
            return new EmbeddingBatchResult(targets.size(), 0, targets.size(), pendingCount(categoryIds));
        }

        int completed = 0;
        int failed = 0;
        for (int i = 0; i < targets.size(); i++) {
            Question q = targets.get(i);
            try {
                float[] vector = response.getResults().get(i).getOutput();
                entityManager.createNativeQuery(
                                "UPDATE questions SET embedding_vector = CAST(:v AS vector) WHERE id = :id")
                        .setParameter("v", toVectorLiteral(vector))
                        .setParameter("id", q.getId())
                        .executeUpdate();
                q.markEmbedded(embeddingModelName);
                completed++;
            } catch (Exception e) {
                log.warn("Embedding write failed for question {}", q.getId(), e);
                q.markFailed(e.getMessage());
                failed++;
            }
        }
        return new EmbeddingBatchResult(targets.size(), completed, failed, pendingCount(categoryIds));
    }

    private static String toVectorLiteral(float[] vector) {
        StringBuilder sb = new StringBuilder(vector.length * 10);
        sb.append('[');
        for (int i = 0; i < vector.length; i++) {
            if (i > 0) sb.append(',');
            sb.append(vector[i]);
        }
        sb.append(']');
        return sb.toString();
    }
}
