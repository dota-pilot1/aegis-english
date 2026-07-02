package com.cj.englishagenthub.exam.infrastructure;

import com.cj.englishagenthub.exam.domain.Exam;
import com.cj.englishagenthub.exam.domain.ExamStatus;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ExamRepository extends JpaRepository<Exam, String> {
    List<Exam> findAllByOrderByCreatedAtDesc();
    List<Exam> findByStatusOrderByCreatedAtDesc(ExamStatus status);
    long countByExamCategory_Id(Long examCategoryId);
    boolean existsByExamCategory_Id(Long examCategoryId);

    @Query("select e.examCategory.id as examCategoryId, count(e) as cnt from Exam e where e.examCategory is not null group by e.examCategory.id")
    List<ExamCategoryCount> countGroupByExamCategory();

    interface ExamCategoryCount {
        Long getExamCategoryId();
        long getCnt();
    }
}
