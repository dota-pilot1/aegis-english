package com.cj.englishagenthub.ai.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RealtimeClientSecretRequest(
        @NotBlank
        String agentId,
        boolean autoKoEn,

        @Size(max = 6000)
        String instructions
) {
}
