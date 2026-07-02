package com.cj.englishagenthub.ai.presentation.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AiChatMessageRequest(
        @Size(max = 120)
        String agentId,

        @Size(max = 12000)
        String message,

        @Size(max = 6000)
        String instructions,

        // 최신 user 메시지 이전의 과거 턴들(oldest → newest). 비어있으면 무시.
        @Size(max = 40) List<@Valid ChatTurn> history,

        @Size(max = 3) List<@Valid AiChatImageInput> images
) {
}
