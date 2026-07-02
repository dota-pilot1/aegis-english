package com.cj.englishagenthub.conversation.presentation.dto;

import com.cj.englishagenthub.conversation.domain.ConversationSaveMessage;

public record ConversationSaveMessageResponse(
        Long id,
        String role,
        int messageOrder,
        String text,
        String sourceText,
        String translatedText,
        String sourceLabel,
        String translatedLabel
) {
    public static ConversationSaveMessageResponse from(ConversationSaveMessage message) {
        return new ConversationSaveMessageResponse(
                message.getId(),
                message.getRole().name().toLowerCase(),
                message.getMessageOrder(),
                message.getText(),
                message.getSourceText(),
                message.getTranslatedText(),
                message.getSourceLabel(),
                message.getTranslatedLabel()
        );
    }
}
