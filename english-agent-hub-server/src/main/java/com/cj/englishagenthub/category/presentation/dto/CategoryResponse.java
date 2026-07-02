package com.cj.englishagenthub.category.presentation.dto;

import com.cj.englishagenthub.category.domain.Category;

public record CategoryResponse(
        Long id,
        Long parentId,
        String name,
        int displayOrder,
        long questionCount
) {
    public static CategoryResponse from(Category category, long questionCount) {
        return new CategoryResponse(
                category.getId(),
                category.getParentId(),
                category.getName(),
                category.getDisplayOrder(),
                questionCount
        );
    }
}
