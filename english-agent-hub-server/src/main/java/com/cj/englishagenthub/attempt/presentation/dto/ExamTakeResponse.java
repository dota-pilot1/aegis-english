package com.cj.englishagenthub.attempt.presentation.dto;

import com.cj.englishagenthub.attempt.domain.ExamAttempt;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionType;

import java.time.Instant;
import java.util.List;

/**
 * 응시자 화면용 시험지. 정답/해설은 절대 포함하지 않는다.
 */
public record ExamTakeResponse(
        String attemptId,
        String examId,
        String title,
        String description,
        Integer timeLimitMinutes,
        int maxScore,
        Instant startedAt,
        List<TakeItem> items
) {
    public record TakeItem(
            String questionId,
            int orderNo,
            QuestionType questionType,
            String question,
            String passage,
            List<String> choices,
            int maxPoints
    ) {}

    public static ExamTakeResponse from(ExamAttempt attempt) {
        List<TakeItem> items = attempt.getAnswers().stream()
                .map(a -> {
                    Question q = a.getQuestion();
                    return new TakeItem(
                            q.getId(),
                            a.getOrderNo(),
                            q.getQuestionType(),
                            q.getQuestion(),
                            q.getPassage(),
                            q.getChoices(),
                            a.getMaxPoints()
                    );
                })
                .toList();
        return new ExamTakeResponse(
                attempt.getId(),
                attempt.getExam().getId(),
                attempt.getExam().getTitle(),
                attempt.getExam().getDescription(),
                attempt.getExam().getTimeLimitMinutes(),
                attempt.getMaxScore(),
                attempt.getStartedAt(),
                items
        );
    }
}
