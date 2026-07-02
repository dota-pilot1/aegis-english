package com.cj.englishagenthub.reference_data.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "english_vocabulary_limits",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_english_vocabulary_limit_curriculum_subject",
                columnNames = {"curriculum_version", "subject_name"}
        ),
        indexes = @Index(name = "idx_english_vocabulary_limit_sort_order", columnList = "sort_order")
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class EnglishVocabularyLimit {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(name = "curriculum_version", nullable = false, length = 30)
    private String curriculumVersion;

    @Column(name = "school_level", nullable = false, length = 30)
    private String schoolLevel;

    @Column(name = "subject_group", nullable = false, length = 40)
    private String subjectGroup;

    @Column(name = "subject_name", nullable = false, length = 80)
    private String subjectName;

    @Column(name = "word_limit", nullable = false)
    private int wordLimit;

    @Column(columnDefinition = "TEXT")
    private String note;

    @Column(name = "sort_order", nullable = false)
    private int sortOrder;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static EnglishVocabularyLimit create(
            String curriculumVersion,
            String schoolLevel,
            String subjectGroup,
            String subjectName,
            int wordLimit,
            String note,
            int sortOrder
    ) {
        EnglishVocabularyLimit limit = new EnglishVocabularyLimit();
        limit.update(curriculumVersion, schoolLevel, subjectGroup, subjectName, wordLimit, note, sortOrder);
        return limit;
    }

    public void update(
            String curriculumVersion,
            String schoolLevel,
            String subjectGroup,
            String subjectName,
            int wordLimit,
            String note,
            int sortOrder
    ) {
        this.curriculumVersion = curriculumVersion;
        this.schoolLevel = schoolLevel;
        this.subjectGroup = subjectGroup;
        this.subjectName = subjectName;
        this.wordLimit = wordLimit;
        this.note = note;
        this.sortOrder = sortOrder;
    }
}
