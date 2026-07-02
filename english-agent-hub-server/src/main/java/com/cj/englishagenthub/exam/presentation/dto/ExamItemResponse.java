package com.cj.englishagenthub.exam.presentation.dto;

import com.cj.englishagenthub.exam.domain.ExamItem;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.domain.QuestionType;

import java.util.List;

/**
 * 출제 관리(관리자) 화면용 문항 응답. 정답/해설 포함.
 */
public record ExamItemResponse(
        String questionId,
        int orderNo,
        int points,
        QuestionType questionType,
        QuestionDifficulty difficulty,
        List<String> categoryPath,
        String question,
        String passage,
        List<String> choices,
        String answer,
        String explanation
) {
    public static ExamItemResponse from(ExamItem item) {
        Question q = item.getQuestion();
        return new ExamItemResponse(
                q.getId(),
                item.getOrderNo(),
                item.getPoints(),
                q.getQuestionType(),
                q.getDifficulty(),
                q.getCategory().getPathNames(),
                q.getQuestion(),
                q.getPassage(),
                q.getChoices(),
                q.getAnswer(),
                q.getExplanation()
        );
    }
}
