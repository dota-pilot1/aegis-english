package com.cj.englishagenthub.attempt.domain;

import com.cj.englishagenthub.exam.domain.Exam;
import com.cj.englishagenthub.exam.domain.ExamItem;
import com.cj.englishagenthub.question.domain.Question;
import com.cj.englishagenthub.user.domain.User;
import jakarta.persistence.*;
import lombok.AccessLevel;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.hibernate.annotations.CreationTimestamp;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * 한 응시자의 시험 응시 기록. 시작 시 시험지 문항을 답안 슬롯으로 스냅샷하고,
 * 제출 시 채점기(AnswerGrader)로 일괄 채점한다.
 */
@Entity
@Table(name = "exam_attempts")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
public class ExamAttempt {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private String id;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private Exam exam;

    @ManyToOne(fetch = FetchType.EAGER, optional = false)
    @JoinColumn(name = "examinee_id", nullable = false)
    private User examinee;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private AttemptStatus status = AttemptStatus.IN_PROGRESS;

    @OneToMany(mappedBy = "attempt", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("orderNo ASC")
    private List<AttemptAnswer> answers = new ArrayList<>();

    @Column(name = "total_score", nullable = false)
    private int totalScore;

    @Column(name = "max_score", nullable = false)
    private int maxScore;

    @Column(name = "requires_review", nullable = false)
    private boolean requiresReview;

    @CreationTimestamp
    @Column(name = "started_at", nullable = false, updatable = false)
    private Instant startedAt;

    @Column(name = "submitted_at")
    private Instant submittedAt;

    /** 발행된 시험지의 문항을 답안 슬롯으로 스냅샷하며 응시를 시작한다. */
    public static ExamAttempt start(Exam exam, User examinee) {
        ExamAttempt attempt = new ExamAttempt();
        attempt.exam = exam;
        attempt.examinee = examinee;
        attempt.status = AttemptStatus.IN_PROGRESS;
        attempt.maxScore = exam.totalPoints();
        for (ExamItem item : exam.getItems()) {
            attempt.answers.add(AttemptAnswer.of(attempt, item.getQuestion(), item.getOrderNo(), item.getPoints()));
        }
        return attempt;
    }

    public boolean isOwnedBy(Long userId) {
        return examinee.getId().equals(userId);
    }

    public boolean isSubmitted() {
        return status == AttemptStatus.SUBMITTED;
    }

    /**
     * questionId→답안 맵을 반영하고 채점기로 일괄 채점한 뒤 제출 상태로 전환한다.
     */
    public void submit(Map<String, String> answerByQuestionId, AnswerGrader grader) {
        if (isSubmitted()) {
            throw new IllegalStateException("이미 제출된 응시입니다.");
        }
        int total = 0;
        boolean review = false;
        for (AttemptAnswer answer : answers) {
            String submitted = answerByQuestionId.get(answer.getQuestion().getId());
            answer.record(submitted);
            AnswerGrader.Outcome outcome = grader.grade(answer.getQuestion(), submitted, answer.getMaxPoints());
            answer.applyGrade(outcome.correct(), outcome.earnedPoints(), outcome.requiresReview());
            total += outcome.earnedPoints();
            review = review || outcome.requiresReview();
        }
        this.totalScore = total;
        this.requiresReview = review;
        this.status = AttemptStatus.SUBMITTED;
        this.submittedAt = Instant.now();
    }

    /** 채점 전략을 도메인에 주입하기 위한 인터페이스(application 의존 제거용). */
    public interface AnswerGrader {
        Outcome grade(Question question, String submittedAnswer, int maxPoints);

        record Outcome(boolean correct, int earnedPoints, boolean requiresReview) {}
    }
}
