package com.cj.englishagenthub.conversation.application;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.conversation.domain.ConversationMessageRole;
import com.cj.englishagenthub.conversation.domain.ConversationSave;
import com.cj.englishagenthub.conversation.infrastructure.ConversationSaveRepository;
import com.cj.englishagenthub.conversation.presentation.dto.ConversationSaveDetailResponse;
import com.cj.englishagenthub.conversation.presentation.dto.ConversationSaveMessageRequest;
import com.cj.englishagenthub.conversation.presentation.dto.ConversationSaveSummaryResponse;
import com.cj.englishagenthub.conversation.presentation.dto.CreateConversationSaveRequest;
import com.cj.englishagenthub.conversation.presentation.dto.UpdateConversationSaveNoteRequest;
import com.cj.englishagenthub.user.domain.User;
import com.cj.englishagenthub.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ConversationSaveService {

    private final ConversationSaveRepository conversationSaveRepository;
    private final UserRepository userRepository;

    @Transactional(readOnly = true)
    public List<ConversationSaveSummaryResponse> list(UserPrincipal principal, String agentId) {
        return conversationSaveRepository.findByUserIdAndAgentIdOrderByCreatedAtDesc(principal.getId(), agentId).stream()
                .map(ConversationSaveSummaryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ConversationSaveDetailResponse get(UserPrincipal principal, Long id) {
        return ConversationSaveDetailResponse.from(loadOwnedOrThrow(principal, id));
    }

    @Transactional
    public ConversationSaveDetailResponse create(UserPrincipal principal, CreateConversationSaveRequest request) {
        User user = userRepository.findById(principal.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        ConversationSave save = ConversationSave.create(
                user,
                request.agentId(),
                request.agentTitle(),
                request.title(),
                request.summary()
        );
        save.updateNote(request.note());

        request.messages().stream()
                .sorted(Comparator.comparing(ConversationSaveMessageRequest::messageOrder))
                .forEach(message -> save.addMessage(
                        parseRole(message.role()),
                        message.messageOrder(),
                        message.text(),
                        message.sourceText(),
                        message.translatedText(),
                        message.sourceLabel(),
                        message.translatedLabel()
                ));

        return ConversationSaveDetailResponse.from(conversationSaveRepository.save(save));
    }

    @Transactional
    public ConversationSaveDetailResponse updateNote(UserPrincipal principal, Long id, UpdateConversationSaveNoteRequest request) {
        ConversationSave save = loadOwnedOrThrow(principal, id);
        save.updateNote(request.note());
        return ConversationSaveDetailResponse.from(save);
    }

    @Transactional
    public void delete(UserPrincipal principal, Long id) {
        ConversationSave save = loadOwnedOrThrow(principal, id);
        conversationSaveRepository.delete(save);
    }

    private ConversationSave loadOwnedOrThrow(UserPrincipal principal, Long id) {
        return conversationSaveRepository.findByIdAndUserId(id, principal.getId())
                .orElseThrow(() -> new BusinessException(ErrorCode.CONVERSATION_SAVE_NOT_FOUND));
    }

    private ConversationMessageRole parseRole(String rawRole) {
        if ("agent".equalsIgnoreCase(rawRole) || "assistant".equalsIgnoreCase(rawRole)) {
            return ConversationMessageRole.AGENT;
        }
        if ("learner".equalsIgnoreCase(rawRole) || "user".equalsIgnoreCase(rawRole)) {
            return ConversationMessageRole.LEARNER;
        }
        throw new BusinessException(ErrorCode.VALIDATION_FAILED);
    }
}
