package com.cj.englishagenthub.question.presentation.dto;

import java.util.List;

/**
 * PDF에서 추출한 독해 문항 1개 (검수 전 원본).
 * 정답·해설은 문제지에 없으므로 비어 있고, 검수 단계에서 사람이 채운다.
 */
public record ExtractedQuestionResponse(
        Integer number,
        String prompt,
        String passage,
        List<String> choices,
        String answer,
        String explanation,
        String type
) {
}
