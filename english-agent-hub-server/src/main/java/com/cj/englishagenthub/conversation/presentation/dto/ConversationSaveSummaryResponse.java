package com.cj.englishagenthub.conversation.presentation.dto;

import com.cj.englishagenthub.conversation.domain.ConversationSave;

import java.time.Instant;

public record ConversationSaveSummaryResponse(
        Long id,
        String agentId,
        String agentTitle,
        String title,
        String summary,
        String note,
        int messageCount,
        Instant createdAt,
        Instant updatedAt
) {
    public static ConversationSaveSummaryResponse from(ConversationSave save) {
        return new ConversationSaveSummaryResponse(
                save.getId(),
                save.getAgentId(),
                save.getAgentTitle(),
                save.getTitle(),
                save.getSummary(),
                save.getNote(),
                save.getMessages().size(),
                save.getCreatedAt(),
                save.getUpdatedAt()
        );
    }
}
