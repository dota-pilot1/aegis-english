package com.cj.englishagenthub.conversation.presentation.dto;

import com.cj.englishagenthub.conversation.domain.ConversationSave;

import java.time.Instant;
import java.util.List;

public record ConversationSaveDetailResponse(
        Long id,
        String agentId,
        String agentTitle,
        String title,
        String summary,
        String note,
        Instant createdAt,
        Instant updatedAt,
        List<ConversationSaveMessageResponse> messages
) {
    public static ConversationSaveDetailResponse from(ConversationSave save) {
        return new ConversationSaveDetailResponse(
                save.getId(),
                save.getAgentId(),
                save.getAgentTitle(),
                save.getTitle(),
                save.getSummary(),
                save.getNote(),
                save.getCreatedAt(),
                save.getUpdatedAt(),
                save.getMessages().stream()
                        .map(ConversationSaveMessageResponse::from)
                        .toList()
        );
    }
}
