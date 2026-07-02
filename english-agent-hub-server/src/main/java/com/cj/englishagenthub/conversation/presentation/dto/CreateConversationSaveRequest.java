package com.cj.englishagenthub.conversation.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.util.List;

public record CreateConversationSaveRequest(
        @NotBlank @Size(max = 100) String agentId,
        @Size(max = 150) String agentTitle,
        @NotBlank @Size(max = 200) String title,
        @Size(max = 500) String summary,
        String note,
        @NotEmpty List<@Valid ConversationSaveMessageRequest> messages
) {
}
