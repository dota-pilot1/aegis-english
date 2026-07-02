package com.cj.englishagenthub.attempt.application.grading;

/**
 * 한 문항 채점 결과.
 *
 * @param correct        정답 여부
 * @param earnedPoints   획득 점수
 * @param requiresReview 사람/AI 재검토 권장 여부 (주관식 단순 매칭은 신뢰도가 낮아 true)
 */
public record GradeResult(boolean correct, int earnedPoints, boolean requiresReview) {

    public static GradeResult correct(int points, boolean requiresReview) {
        return new GradeResult(true, points, requiresReview);
    }

    public static GradeResult wrong(boolean requiresReview) {
        return new GradeResult(false, 0, requiresReview);
    }
}
