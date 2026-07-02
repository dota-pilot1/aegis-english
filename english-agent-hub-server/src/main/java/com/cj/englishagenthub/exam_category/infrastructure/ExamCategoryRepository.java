package com.cj.englishagenthub.exam_category.infrastructure;

import com.cj.englishagenthub.exam_category.domain.ExamCategory;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamCategoryRepository extends JpaRepository<ExamCategory, Long> {
    List<ExamCategory> findAllByOrderByDisplayOrderAscIdAsc();
    Optional<ExamCategory> findFirstByParentIsNullAndName(String name);
    Optional<ExamCategory> findFirstByParent_IdAndName(Long parentId, String name);
    boolean existsByParent_Id(Long parentId);
    boolean existsByParent_IdAndName(Long parentId, String name);
    boolean existsByParentIsNullAndName(String name);
    long countByParent_Id(Long parentId);
    long countByParentIsNull();
}
