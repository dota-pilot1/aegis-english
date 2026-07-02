package com.cj.englishagenthub.reference_data.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.OneToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.Objects;

@Entity
@Table(
        name = "english_vocabulary_enrichments",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_english_vocabulary_enrichment_item",
                columnNames = "vocabulary_item_id"
        ),
        indexes = @Index(name = "idx_english_vocabulary_enrichment_status", columnList = "status")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EnglishVocabularyEnrichment {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @OneToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "vocabulary_item_id", nullable = false)
    private EnglishVocabularyItem vocabularyItem;

    @Column(name = "meaning_ko", columnDefinition = "TEXT")
    private String meaningKo;

    @Column(name = "part_of_speech", length = 80)
    private String partOfSpeech;

    @Column(name = "example_sentence", columnDefinition = "TEXT")
    private String exampleSentence;

    @Column(name = "example_translation", columnDefinition = "TEXT")
    private String exampleTranslation;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private VocabularyEnrichmentStatus status = VocabularyEnrichmentStatus.EMPTY;

    @Column(name = "generated_model", length = 80)
    private String generatedModel;

    @Column(name = "generated_at")
    private Instant generatedAt;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static EnglishVocabularyEnrichment createEmpty(EnglishVocabularyItem item) {
        EnglishVocabularyEnrichment enrichment = new EnglishVocabularyEnrichment();
        enrichment.vocabularyItem = item;
        enrichment.status = VocabularyEnrichmentStatus.EMPTY;
        return enrichment;
    }

    public void applyAiGenerated(
            String meaningKo,
            String partOfSpeech,
            String exampleSentence,
            String exampleTranslation,
            String generatedModel
    ) {
        this.meaningKo = meaningKo;
        this.partOfSpeech = partOfSpeech;
        this.exampleSentence = exampleSentence;
        this.exampleTranslation = exampleTranslation;
        this.status = VocabularyEnrichmentStatus.AI_GENERATED;
        this.generatedModel = generatedModel;
        this.generatedAt = Instant.now();
    }

    public boolean hasSameAiGeneratedContent(
            String meaningKo,
            String partOfSpeech,
            String exampleSentence,
            String exampleTranslation,
            String generatedModel
    ) {
        return status == VocabularyEnrichmentStatus.AI_GENERATED
                && Objects.equals(this.meaningKo, meaningKo)
                && Objects.equals(this.partOfSpeech, partOfSpeech)
                && Objects.equals(this.exampleSentence, exampleSentence)
                && Objects.equals(this.exampleTranslation, exampleTranslation)
                && Objects.equals(this.generatedModel, generatedModel);
    }
}
