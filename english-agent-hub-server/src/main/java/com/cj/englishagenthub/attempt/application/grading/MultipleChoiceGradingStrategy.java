package com.cj.englishagenthub.attempt.application.grading;

import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionType;
import org.springframework.stereotype.Component;

/**
 * 객관식 채점: 제출 답안이 정답 보기와 정확히 일치하면 정답.
 * 자동 채점 100% 신뢰 → 재검토 불필요.
 */
@Component
public class MultipleChoiceGradingStrategy implements GradingStrategy {

    @Override
    public boolean supports(QuestionType type) {
        return type == QuestionType.MULTIPLE_CHOICE;
    }

    @Override
    public GradeResult grade(Question question, String submittedAnswer, int maxPoints) {
        String submitted = submittedAnswer == null ? "" : submittedAnswer.trim();
        boolean correct = submitted.equals(question.getAnswer().trim());
        return correct ? GradeResult.correct(maxPoints, false) : GradeResult.wrong(false);
    }
}
