package com.cj.englishagenthub.attempt.domain;

import com.cj.englishagenthub.question.domain.Question;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;

/**
 * 응시자의 한 문항 답안. 시작 시 시험지 문항으로부터 스냅샷(orderNo, maxPoints)을 떠
 * 이후 시험지가 수정되어도 채점 결과가 흔들리지 않게 한다.
 */
@Entity
@Table(name = "attempt_answers")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class AttemptAnswer {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private ExamAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private Question question;

    @Column(name = "order_no", nullable = false)
    private int orderNo;

    @Column(name = "max_points", nullable = false)
    private int maxPoints;

    @Column(name = "submitted_answer", columnDefinition = "TEXT")
    private String submittedAnswer;

    /** 채점 전 null. */
    @Column
    private Boolean correct;

    @Column(name = "earned_points", nullable = false)
    private int earnedPoints;

    @Column(name = "requires_review", nullable = false)
    private boolean requiresReview;

    static AttemptAnswer of(ExamAttempt attempt, Question question, int orderNo, int maxPoints) {
        AttemptAnswer a = new AttemptAnswer();
        a.attempt = attempt;
        a.question = question;
        a.orderNo = orderNo;
        a.maxPoints = maxPoints;
        a.earnedPoints = 0;
        a.requiresReview = false;
        return a;
    }

    void record(String submittedAnswer) {
        this.submittedAnswer = submittedAnswer;
    }

    void applyGrade(boolean correct, int earnedPoints, boolean requiresReview) {
        this.correct = correct;
        this.earnedPoints = earnedPoints;
        this.requiresReview = requiresReview;
    }
}
