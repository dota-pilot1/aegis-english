package com.cj.englishagenthub.attempt.application.grading;

import com.cj.englishagenthub.question.domain.Question;
import org.springframework.stereotype.Service;

import java.util.List;

/**
 * 등록된 채점 전략 중 문제 유형을 지원하는 첫 전략으로 채점한다.
 * 전략 빈의 순서(@Order)로 우선순위를 조정할 수 있어, 같은 유형에 대해
 * 더 정확한 전략(예: AI)을 우선 적용하도록 확장 가능하다.
 */
@Service
public class GradingService {

    private final List<GradingStrategy> strategies;

    public GradingService(List<GradingStrategy> strategies) {
        this.strategies = strategies;
    }

    public GradeResult grade(Question question, String submittedAnswer, int maxPoints) {
        return strategies.stream()
                .filter(s -> s.supports(question.getQuestionType()))
                .findFirst()
                .map(s -> s.grade(question, submittedAnswer, maxPoints))
                .orElseGet(() -> GradeResult.wrong(true));
    }
}
