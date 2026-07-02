package com.cj.englishagenthub.conversation.domain;

import com.cj.englishagenthub.user.domain.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "conversation_saves")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConversationSave {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(nullable = false, length = 100)
    private String agentId;

    @Column(length = 150)
    private String agentTitle;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(length = 500)
    private String summary;

    @Column(columnDefinition = "TEXT")
    private String note;

    @OneToMany(mappedBy = "conversationSave", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("messageOrder ASC")
    private List<ConversationSaveMessage> messages = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static ConversationSave create(
            User user,
            String agentId,
            String agentTitle,
            String title,
            String summary
    ) {
        ConversationSave save = new ConversationSave();
        save.user = user;
        save.agentId = agentId;
        save.agentTitle = agentTitle;
        save.title = title;
        save.summary = summary;
        return save;
    }

    public void updateNote(String note) {
        this.note = note;
    }

    public void addMessage(
            ConversationMessageRole role,
            int messageOrder,
            String text,
            String sourceText,
            String translatedText,
            String sourceLabel,
            String translatedLabel
    ) {
        messages.add(ConversationSaveMessage.create(
                this,
                role,
                messageOrder,
                text,
                sourceText,
                translatedText,
                sourceLabel,
                translatedLabel
        ));
    }

    public boolean isOwnedBy(Long userId) {
        return user != null && user.getId().equals(userId);
    }
}
