package com.cj.englishagenthub.exam.domain;

import com.cj.englishagenthub.category.domain.Category;
import com.cj.englishagenthub.exam_category.domain.ExamCategory;
import com.cj.englishagenthub.question.domain.Question;
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

/**
 * 시험지(출제 단위). 문제 은행에서 고른 문항(ExamItem)들을 담는다.
 * DRAFT 상태에서 자유롭게 편집하고, PUBLISHED 되면 응시 가능, CLOSED 되면 마감.
 */
@Entity
@Table(name = "exams")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class Exam {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @Column(nullable = false, length = 200)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String description;

    /** 과목(문제 분류 트리의 노드, 보통 최상위). null이면 미분류. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "subject_id")
    private Category subject;

    /** 시험지 운영 분류. 문제은행 출제 범위(subject)와 별도 관리한다. */
    @ManyToOne(fetch = FetchType.EAGER)
    @JoinColumn(name = "exam_category_id")
    private ExamCategory examCategory;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "created_by", nullable = false)
    private User createdBy;

    /** 제한 시간(분). null이면 무제한. */
    @Column(name = "time_limit_minutes")
    private Integer timeLimitMinutes;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private ExamStatus status = ExamStatus.DRAFT;

    @OneToMany(mappedBy = "exam", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderNo ASC")
    private List<ExamItem> items = new ArrayList<>();

    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(nullable = false)
    private Instant updatedAt;

    public static Exam create(
            User createdBy,
            String title,
            String description,
            Integer timeLimitMinutes,
            Category subject,
            ExamCategory examCategory
    ) {
        Exam exam = new Exam();
        exam.createdBy = createdBy;
        exam.title = title;
        exam.description = description;
        exam.timeLimitMinutes = normalizeTimeLimit(timeLimitMinutes);
        exam.subject = subject;
        exam.examCategory = examCategory;
        exam.status = ExamStatus.DRAFT;
        return exam;
    }

    public void updateMeta(String title, String description, Integer timeLimitMinutes, Category subject, ExamCategory examCategory) {
        requireEditable();
        this.title = title;
        this.description = description;
        this.timeLimitMinutes = normalizeTimeLimit(timeLimitMinutes);
        this.subject = subject;
        this.examCategory = examCategory;
    }

    /**
     * 문항 전체 교체. (question, points) 순서대로 ExamItem 재구성.
     * DRAFT 상태에서만 허용.
     */
    public void replaceItems(List<ItemSpec> specs) {
        requireEditable();
        this.items.clear();
        int order = 1;
        for (ItemSpec spec : specs) {
            this.items.add(ExamItem.of(this, spec.question(), order++, spec.points()));
        }
    }

    /**
     * 원본 시험지의 메타와 (배점·순서) 구조를 그대로 복제하되, 문항만 새 문항으로 교체한 변형본을 만든다.
     * 항상 DRAFT로 시작한다. 표절이 아니라 "동형 시험지"가 되도록 새 문항은 외부에서 생성해 주입받는다.
     *
     * @param replacementQuestions 원본 문항(orderNo ASC)과 1:1로 대응하는 새 문항 목록
     */
    public static Exam variantOf(Exam source, User creator, List<Question> replacementQuestions) {
        if (source.items.isEmpty()) {
            throw new IllegalStateException("문항이 없는 시험은 변형할 수 없습니다.");
        }
        if (replacementQuestions.size() != source.items.size()) {
            throw new IllegalArgumentException("변형 문항 수가 원본 문항 수와 일치해야 합니다.");
        }
        Exam variant = create(
                creator,
                source.title + " (변형본)",
                source.description,
                source.timeLimitMinutes,
                source.subject,
                source.examCategory
        );
        List<ItemSpec> specs = new ArrayList<>();
        for (int i = 0; i < source.items.size(); i++) {
            specs.add(new ItemSpec(replacementQuestions.get(i), source.items.get(i).getPoints()));
        }
        variant.replaceItems(specs);
        return variant;
    }

    public void publish() {
        if (status == ExamStatus.PUBLISHED) return;
        if (status == ExamStatus.CLOSED) {
            throw new IllegalStateException("마감된 시험은 다시 발행할 수 없습니다.");
        }
        if (items.isEmpty()) {
            throw new IllegalStateException("문항이 없는 시험은 발행할 수 없습니다.");
        }
        this.status = ExamStatus.PUBLISHED;
    }

    public void close() {
        this.status = ExamStatus.CLOSED;
    }

    public int totalPoints() {
        return items.stream().mapToInt(ExamItem::getPoints).sum();
    }

    public boolean isPublished() {
        return status == ExamStatus.PUBLISHED;
    }

    private void requireEditable() {
        if (status != ExamStatus.DRAFT) {
            throw new IllegalStateException("발행되었거나 마감된 시험은 편집할 수 없습니다.");
        }
    }

    private static Integer normalizeTimeLimit(Integer minutes) {
        if (minutes == null) return null;
        return minutes <= 0 ? null : minutes;
    }

    /** 문항 구성 입력값. 서비스에서 Question 로딩 후 전달. */
    public record ItemSpec(Question question, int points) {}
}
