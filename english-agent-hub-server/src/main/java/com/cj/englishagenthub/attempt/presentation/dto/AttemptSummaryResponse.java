package com.cj.englishagenthub.attempt.presentation.dto;

import com.cj.englishagenthub.attempt.domain.AttemptStatus;
import com.cj.englishagenthub.attempt.domain.ExamAttempt;

import java.time.Instant;

/**
 * 응시 이력 목록용 경량 응답(문항 제외).
 */
public record AttemptSummaryResponse(
        String attemptId,
        String examId,
        String examTitle,
        Long examineeId,
        String examineeName,
        AttemptStatus status,
        int totalScore,
        int maxScore,
        boolean requiresReview,
        Instant startedAt,
        Instant submittedAt
) {
    public static AttemptSummaryResponse from(ExamAttempt a) {
        return new AttemptSummaryResponse(
                a.getId(),
                a.getExam().getId(),
                a.getExam().getTitle(),
                a.getExaminee().getId(),
                a.getExaminee().getUsername(),
                a.getStatus(),
                a.getTotalScore(),
                a.getMaxScore(),
                a.isRequiresReview(),
                a.getStartedAt(),
                a.getSubmittedAt()
        );
    }
}
