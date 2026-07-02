package com.cj.englishagenthub.category.domain;

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
@Table(
        name = "question_categories",
        uniqueConstraints = @UniqueConstraint(name = "uk_question_categories_parent_name", columnNames = {"parent_id", "name"})
)
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Category {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_id")
    private Category parent;

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

    public static Category create(Category parent, String name, int displayOrder) {
        Category category = new Category();
        category.parent = parent;
        category.name = name.trim();
        category.displayOrder = displayOrder;
        return category;
    }

    public void rename(String name) {
        this.name = name.trim();
    }

    public Long getParentId() {
        return parent == null ? null : parent.getId();
    }

    /** 루트 → 자신 순서의 이름 경로. 트랜잭션 안에서 호출할 것(LAZY 부모 탐색). */
    public List<String> getPathNames() {
        List<String> names = new ArrayList<>();
        Category cursor = this;
        while (cursor != null) {
            names.add(0, cursor.getName());
            cursor = cursor.getParent();
        }
        return names;
    }
}
