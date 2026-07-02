package com.cj.englishagenthub.ai.presentation.dto;

import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record AiChatImageInput(
        @Pattern(regexp = "^data:image/(png|jpeg|jpg|webp|gif);base64,.+")
        @Size(max = 8_000_000)
        String dataUrl
) {
}
