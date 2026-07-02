package com.cj.englishagenthub.exam_category.domain;

import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;

@Entity
@Table(
        name = "exam_categories",
        uniqueConstraints = @UniqueConstraint(name = "uk_exam_categories_parent_name", columnNames = {"parent_id", "name"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamCategory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private ExamCategory parent;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "display_order", nullable = false)
    private int displayOrder;

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static ExamCategory create(ExamCategory parent, String name, int displayOrder) {
        ExamCategory category = new ExamCategory();
        category.parent = parent;
        category.name = name.trim();
        category.displayOrder = displayOrder;
        return category;
    }

    public void rename(String name) {
        this.name = name.trim();
    }

    public void reorder(int displayOrder) {
        this.displayOrder = displayOrder;
    }

    public Long getParentId() {
        return parent == null ? null : parent.getId();
    }
}
