package com.cj.englishagenthub.question.infrastructure;

import com.cj.englishagenthub.question.domain.EmbeddingStatus;
import com.cj.englishagenthub.question.domain.Question;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface QuestionRepository extends JpaRepository<Question, String>, JpaSpecificationExecutor<Question> {
    Optional<Question> findFirstByQuestion(String question);
    List<Question> findByEmbeddingStatusInOrderByCreatedAtAsc(Collection<EmbeddingStatus> statuses, Pageable pageable);
    List<Question> findByEmbeddingStatusInAndCategory_IdInOrderByCreatedAtAsc(
            Collection<EmbeddingStatus> statuses, Collection<Long> categoryIds, Pageable pageable);
    long countByEmbeddingStatus(EmbeddingStatus status);
    long countByEmbeddingStatusAndCategory_IdIn(EmbeddingStatus status, Collection<Long> categoryIds);
    long countByCategory_Id(Long categoryId);
    boolean existsByCategory_Id(Long categoryId);

    interface CategoryCount {
        Long getCategoryId();
        long getCnt();
    }

    @Query("select q.category.id as categoryId, count(q) as cnt from Question q group by q.category.id")
    List<CategoryCount> countGroupByCategory();
}
