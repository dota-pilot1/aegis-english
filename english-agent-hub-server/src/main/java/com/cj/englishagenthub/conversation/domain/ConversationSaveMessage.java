package com.cj.englishagenthub.conversation.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "conversation_save_messages")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ConversationSaveMessage {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "conversation_save_id", nullable = false)
    private ConversationSave conversationSave;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ConversationMessageRole role;

    @Column(nullable = false)
    private int messageOrder;

    @Column(columnDefinition = "TEXT")
    private String text;

    @Column(columnDefinition = "TEXT")
    private String sourceText;

    @Column(columnDefinition = "TEXT")
    private String translatedText;

    @Column(length = 50)
    private String sourceLabel;

    @Column(length = 50)
    private String translatedLabel;

    public static ConversationSaveMessage create(
            ConversationSave conversationSave,
            ConversationMessageRole role,
            int messageOrder,
            String text,
            String sourceText,
            String translatedText,
            String sourceLabel,
            String translatedLabel
    ) {
        ConversationSaveMessage message = new ConversationSaveMessage();
        message.conversationSave = conversationSave;
        message.role = role;
        message.messageOrder = messageOrder;
        message.text = text;
        message.sourceText = sourceText;
        message.translatedText = translatedText;
        message.sourceLabel = sourceLabel;
        message.translatedLabel = translatedLabel;
        return message;
    }
}
