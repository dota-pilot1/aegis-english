package com.cj.englishagenthub.attempt.application.grading;

import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionType;

/**
 * 문제 유형별 채점 전략. 새 유형(또는 AI 주관식 채점)을 추가하려면
 * 이 인터페이스를 구현한 빈을 등록하면 {@link GradingService}가 자동으로 사용한다.
 */
public interface GradingStrategy {

    boolean supports(QuestionType type);

    GradeResult grade(Question question, String submittedAnswer, int maxPoints);
}
