package com.cj.englishagenthub.attempt.presentation.dto;

import com.cj.englishagenthub.attempt.domain.AttemptAnswer;
import com.cj.englishagenthub.attempt.domain.AttemptStatus;
import com.cj.englishagenthub.attempt.domain.ExamAttempt;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionType;

import java.time.Instant;
import java.util.List;

/**
 * 채점 결과. 제출 후 응시자/관리자에게 정답·해설과 함께 반환.
 */
public record AttemptResultResponse(
        String attemptId,
        String examId,
        String examTitle,
        AttemptStatus status,
        int totalScore,
        int maxScore,
        boolean requiresReview,
        Instant submittedAt,
        List<ResultItem> items
) {
    public record ResultItem(
            String questionId,
            int orderNo,
            QuestionType questionType,
            String question,
            String passage,
            List<String> choices,
            String submittedAnswer,
            String correctAnswer,
            Boolean correct,
            int earnedPoints,
            int maxPoints,
            String explanation,
            boolean requiresReview
    ) {
        static ResultItem from(AttemptAnswer a) {
            Question q = a.getQuestion();
            return new ResultItem(
                    q.getId(),
                    a.getOrderNo(),
                    q.getQuestionType(),
                    q.getQuestion(),
                    q.getPassage(),
                    q.getChoices(),
                    a.getSubmittedAnswer(),
                    q.getAnswer(),
                    a.getCorrect(),
                    a.getEarnedPoints(),
                    a.getMaxPoints(),
                    q.getExplanation(),
                    a.isRequiresReview()
            );
        }
    }

    public static AttemptResultResponse from(ExamAttempt attempt) {
        return new AttemptResultResponse(
                attempt.getId(),
                attempt.getExam().getId(),
                attempt.getExam().getTitle(),
                attempt.getStatus(),
                attempt.getTotalScore(),
                attempt.getMaxScore(),
                attempt.isRequiresReview(),
                attempt.getSubmittedAt(),
                attempt.getAnswers().stream().map(ResultItem::from).toList()
        );
    }
}
