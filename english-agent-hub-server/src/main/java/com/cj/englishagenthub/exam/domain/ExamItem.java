package com.cj.englishagenthub.exam.domain;

import com.cj.englishagenthub.question.domain.Question;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 시험지에 담긴 한 문항. 어떤 문제(Question)를 몇 번째로 몇 점에 출제했는지.
 * Exam 애그리거트의 하위 엔티티.
 */
@Entity
@Table(name = "exam_items")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamItem {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "order_no", nullable = false)
    private int orderNo;

    @Column(nullable = false)
    private int points;

    static ExamItem of(Exam exam, Question question, int orderNo, int points) {
        ExamItem item = new ExamItem();
        item.exam = exam;
        item.question = question;
        item.orderNo = orderNo;
        item.points = Math.max(points, 0);
        return item;
    }
}
