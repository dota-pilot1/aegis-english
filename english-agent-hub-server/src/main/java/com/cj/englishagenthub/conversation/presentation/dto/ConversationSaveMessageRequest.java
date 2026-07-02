package com.cj.englishagenthub.conversation.presentation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ConversationSaveMessageRequest(
        @NotBlank String role,
        @NotNull Integer messageOrder,
        String text,
        String sourceText,
        String translatedText,
        String sourceLabel,
        String translatedLabel
) {
}
