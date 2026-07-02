package com.cj.englishagenthub.exam.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

import java.util.List;

/**
 * 시험지 생성/수정 요청. 문항은 questionId + 배점 목록으로 전달.
 * 문항은 비어 있어도 DRAFT 로 저장되며, 발행 시점에 도메인이 문항 존재를 검증한다.
 */
public record ExamUpsertRequest(
        @NotBlank String title,
        String description,
        Integer timeLimitMinutes,
        Long subjectId,
        Long examCategoryId,
        @Valid List<Item> items
) {
    public List<Item> safeItems() {
        return items == null ? List.of() : items;
    }

    public record Item(
            @NotBlank String questionId,
            @NotNull @Positive Integer points
    ) {}
}
