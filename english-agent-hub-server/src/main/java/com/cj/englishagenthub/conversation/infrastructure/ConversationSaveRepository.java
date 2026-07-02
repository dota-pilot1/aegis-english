package com.cj.englishagenthub.conversation.infrastructure;

import com.cj.englishagenthub.conversation.domain.ConversationSave;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ConversationSaveRepository extends JpaRepository<ConversationSave, Long> {
    List<ConversationSave> findByUserIdAndAgentIdOrderByCreatedAtDesc(Long userId, String agentId);
    Optional<ConversationSave> findByIdAndUserId(Long id, Long userId);
}
