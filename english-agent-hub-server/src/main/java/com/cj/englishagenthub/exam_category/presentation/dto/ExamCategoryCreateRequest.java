package com.cj.englishagenthub.exam_category.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ExamCategoryCreateRequest(
        Long parentId,
        @NotBlank @Size(max = 100) String name
) {
}
