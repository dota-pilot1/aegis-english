package com.cj.englishagenthub.reference_data.domain;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(
        name = "english_vocabulary_items",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_english_vocabulary_curriculum_headword",
                columnNames = {"curriculum_version", "headword"}
        ),
        indexes = {
                @Index(name = "idx_english_vocabulary_marker", columnList = "marker"),
                @Index(name = "idx_english_vocabulary_letter", columnList = "letter"),
                @Index(name = "idx_english_vocabulary_sort_order", columnList = "sort_order")
        }
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EnglishVocabularyItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "curriculum_version", nullable = false, length = 30)
    private String curriculumVersion;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @Column(nullable = false, length = 5)
    private String letter;

    @Column(nullable = false, length = 120)
    private String headword;

    @ElementCollection
    @CollectionTable(
            name = "english_vocabulary_alternative_headwords",
            joinColumns = @JoinColumn(name = "vocabulary_item_id")
    )
    @Column(name = "alternative_headword", length = 120)
    private List<String> alternativeHeadwords = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private EnglishVocabularyMarker marker;

    @Column(name = "marker_symbol", length = 2)
    private String markerSymbol;

    @Column(name = "raw_entry", nullable = false, length = 500)
    private String rawEntry;

    @Column(name = "source_section", nullable = false, length = 100)
    private String sourceSection;

    @Column(nullable = false)
    private boolean active = true;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static EnglishVocabularyItem create(
            String curriculumVersion,
            int sortOrder,
            String letter,
            String headword,
            List<String> alternativeHeadwords,
            EnglishVocabularyMarker marker,
            String markerSymbol,
            String rawEntry,
            String sourceSection
    ) {
        EnglishVocabularyItem item = new EnglishVocabularyItem();
        item.update(curriculumVersion, sortOrder, letter, headword, alternativeHeadwords, marker, markerSymbol, rawEntry, sourceSection);
        return item;
    }

    public void update(
            String curriculumVersion,
            int sortOrder,
            String letter,
            String headword,
            List<String> alternativeHeadwords,
            EnglishVocabularyMarker marker,
            String markerSymbol,
            String rawEntry,
            String sourceSection
    ) {
        this.curriculumVersion = curriculumVersion;
        this.sortOrder = sortOrder;
        this.letter = letter;
        this.headword = headword;
        this.alternativeHeadwords = normalize(alternativeHeadwords);
        this.marker = marker;
        this.markerSymbol = markerSymbol;
        this.rawEntry = rawEntry;
        this.sourceSection = sourceSection;
        this.active = true;
    }

    private static List<String> normalize(List<String> values) {
        if (values == null) return new ArrayList<>();
        return values.stream()
                .filter(value -> value != null && !value.isBlank())
                .map(String::trim)
                .distinct()
                .collect(java.util.stream.Collectors.toCollection(ArrayList::new));
    }
}
