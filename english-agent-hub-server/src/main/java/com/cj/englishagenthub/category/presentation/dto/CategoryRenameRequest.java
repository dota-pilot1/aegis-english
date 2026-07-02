package com.cj.englishagenthub.category.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record CategoryRenameRequest(
        @NotBlank @Size(max = 100) String name
) {
}
