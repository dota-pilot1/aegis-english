package com.cj.englishagenthub.exam_category.presentation.dto;

import com.cj.englishagenthub.exam_category.domain.ExamCategory;

public record ExamCategoryResponse(
        Long id,
        Long parentId,
        String name,
        int displayOrder,
        long examCount
) {
    public static ExamCategoryResponse from(ExamCategory category, long examCount) {
        return new ExamCategoryResponse(
                category.getId(),
                category.getParentId(),
                category.getName(),
                category.getDisplayOrder(),
                examCount
        );
    }
}
