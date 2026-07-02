package com.cj.englishagenthub.attempt.application.grading;

import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.question.domain.QuestionType;
import org.springframework.stereotype.Component;

/**
 * 주관식 채점(MVP): 공백/대소문자를 정규화한 단순 문자열 비교.
 * "합 7, 곱 10" 같은 서술형 답은 정확히 못 잡으므로 requiresReview=true 로 표시해
 * 관리자 수동 보정 또는 추후 AI 채점이 다시 판정하도록 한다.
 *
 * 추후 OpenAI 기반 AiShortAnswerGradingStrategy 를 추가하고 이 빈보다
 * 우선순위를 높게 주면 자동으로 대체된다(GradingService 의 첫 매칭 사용).
 */
@Component
public class ShortAnswerGradingStrategy implements GradingStrategy {

    @Override
    public boolean supports(QuestionType type) {
        return type == QuestionType.SHORT_ANSWER;
    }

    @Override
    public GradeResult grade(Question question, String submittedAnswer, int maxPoints) {
        String submitted = normalize(submittedAnswer);
        String answer = normalize(question.getAnswer());
        if (!submitted.isEmpty() && submitted.equals(answer)) {
            return GradeResult.correct(maxPoints, true);
        }
        return GradeResult.wrong(true);
    }

    private static String normalize(String value) {
        if (value == null) return "";
        return value.trim().toLowerCase().replaceAll("\\s+", "");
    }
}
