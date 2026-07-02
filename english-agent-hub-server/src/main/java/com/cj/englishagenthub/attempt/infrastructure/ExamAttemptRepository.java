package com.cj.englishagenthub.attempt.infrastructure;

import com.cj.englishagenthub.attempt.domain.AttemptStatus;
import com.cj.englishagenthub.attempt.domain.ExamAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExamAttemptRepository extends JpaRepository<ExamAttempt, String> {
    Optional<ExamAttempt> findFirstByExam_IdAndExaminee_IdAndStatus(String examId, Long examineeId, AttemptStatus status);
    List<ExamAttempt> findByExaminee_IdOrderByStartedAtDesc(Long examineeId);
    List<ExamAttempt> findByExam_IdOrderByStartedAtDesc(String examId);
}
