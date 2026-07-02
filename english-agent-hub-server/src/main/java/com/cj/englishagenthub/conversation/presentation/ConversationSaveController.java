package com.cj.englishagenthub.conversation.presentation;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.conversation.application.ConversationSaveService;
import com.cj.englishagenthub.conversation.presentation.dto.ConversationSaveDetailResponse;
import com.cj.englishagenthub.conversation.presentation.dto.ConversationSaveSummaryResponse;
import com.cj.englishagenthub.conversation.presentation.dto.CreateConversationSaveRequest;
import com.cj.englishagenthub.conversation.presentation.dto.UpdateConversationSaveNoteRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/conversation-saves")
@RequiredArgsConstructor
@Tag(name = "Conversation Saves", description = "AI 학습 대화 저장/조회")
public class ConversationSaveController {

    private final ConversationSaveService conversationSaveService;

    @GetMapping
    @Operation(summary = "내 저장 대화 목록")
    public List<ConversationSaveSummaryResponse> list(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam String agentId
    ) {
        return conversationSaveService.list(principal, agentId);
    }

    @GetMapping("/{id}")
    @Operation(summary = "내 저장 대화 상세")
    public ConversationSaveDetailResponse get(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        return conversationSaveService.get(principal, id);
    }

    @PostMapping
    @Operation(summary = "현재 대화 전체 저장")
    public ConversationSaveDetailResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody CreateConversationSaveRequest request
    ) {
        return conversationSaveService.create(principal, request);
    }

    @PatchMapping("/{id}/note")
    @Operation(summary = "내 저장 대화 노트 저장")
    public ConversationSaveDetailResponse updateNote(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id,
            @RequestBody UpdateConversationSaveNoteRequest request
    ) {
        return conversationSaveService.updateNote(principal, id, request);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "내 저장 대화 삭제")
    public ResponseEntity<Void> delete(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable Long id
    ) {
        conversationSaveService.delete(principal, id);
        return ResponseEntity.noContent().build();
    }
}
