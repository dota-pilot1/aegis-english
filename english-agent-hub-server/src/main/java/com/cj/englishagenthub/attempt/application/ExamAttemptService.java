package com.cj.englishagenthub.attempt.application;

import com.cj.englishagenthub.attempt.application.grading.GradeResult;
import com.cj.englishagenthub.attempt.application.grading.GradingService;
import com.cj.englishagenthub.attempt.domain.AttemptStatus;
import com.cj.englishagenthub.attempt.domain.ExamAttempt;
import com.cj.englishagenthub.attempt.infrastructure.ExamAttemptRepository;
import com.cj.englishagenthub.attempt.presentation.dto.AttemptResultResponse;
import com.cj.englishagenthub.attempt.presentation.dto.AttemptSubmitRequest;
import com.cj.englishagenthub.attempt.presentation.dto.AttemptSummaryResponse;
import com.cj.englishagenthub.attempt.presentation.dto.ExamTakeResponse;
import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.config.RoleSeeder;
import com.cj.englishagenthub.exam.application.ExamService;
import com.cj.englishagenthub.exam.domain.Exam;
import com.cj.englishagenthub.user.domain.User;
import com.cj.englishagenthub.user.infrastructure.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ExamAttemptService {

    private final ExamAttemptRepository attemptRepository;
    private final ExamService examService;
    private final UserRepository userRepository;
    private final GradingService gradingService;

    /** 발행된 시험에 대해 진행 중 응시가 있으면 이어서, 없으면 새로 시작. */
    @Transactional
    public ExamTakeResponse startOrResume(UserPrincipal principal, String examId) {
        Exam exam = examService.loadOrThrow(examId);
        if (!exam.isPublished()) {
            throw new BusinessException(ErrorCode.EXAM_NOT_PUBLISHED);
        }
        return attemptRepository
                .findFirstByExam_IdAndExaminee_IdAndStatus(examId, principal.getId(), AttemptStatus.IN_PROGRESS)
                .map(ExamTakeResponse::from)
                .orElseGet(() -> {
                    User examinee = userRepository.findById(principal.getId())
                            .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
                    ExamAttempt attempt = attemptRepository.save(ExamAttempt.start(exam, examinee));
                    return ExamTakeResponse.from(attempt);
                });
    }

    @Transactional(readOnly = true)
    public ExamTakeResponse getTake(UserPrincipal principal, String attemptId) {
        ExamAttempt attempt = loadOwned(principal, attemptId);
        if (attempt.isSubmitted()) {
            throw new BusinessException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }
        return ExamTakeResponse.from(attempt);
    }

    @Transactional
    public AttemptResultResponse submit(UserPrincipal principal, String attemptId, AttemptSubmitRequest req) {
        ExamAttempt attempt = loadOwned(principal, attemptId);
        if (attempt.isSubmitted()) {
            throw new BusinessException(ErrorCode.ATTEMPT_ALREADY_SUBMITTED);
        }
        attempt.submit(req.toMap(), (question, submitted, maxPoints) -> {
            GradeResult r = gradingService.grade(question, submitted, maxPoints);
            return new ExamAttempt.AnswerGrader.Outcome(r.correct(), r.earnedPoints(), r.requiresReview());
        });
        return AttemptResultResponse.from(attempt);
    }

    @Transactional(readOnly = true)
    public AttemptResultResponse getResult(UserPrincipal principal, String attemptId) {
        ExamAttempt attempt = loadOwnedOrAdmin(principal, attemptId);
        return AttemptResultResponse.from(attempt);
    }

    @Transactional(readOnly = true)
    public List<AttemptSummaryResponse> myAttempts(UserPrincipal principal) {
        return attemptRepository.findByExaminee_IdOrderByStartedAtDesc(principal.getId()).stream()
                .map(AttemptSummaryResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<AttemptSummaryResponse> attemptsOfExam(String examId) {
        return attemptRepository.findByExam_IdOrderByStartedAtDesc(examId).stream()
                .map(AttemptSummaryResponse::from)
                .toList();
    }

    /** 응시 기록 삭제 (관리자). 답안은 cascade/orphanRemoval 로 함께 삭제된다. */
    @Transactional
    public void delete(String attemptId) {
        ExamAttempt attempt = loadOrThrow(attemptId);
        attemptRepository.delete(attempt);
    }

    private ExamAttempt loadOrThrow(String attemptId) {
        return attemptRepository.findById(attemptId)
                .orElseThrow(() -> new BusinessException(ErrorCode.ATTEMPT_NOT_FOUND));
    }

    private ExamAttempt loadOwned(UserPrincipal principal, String attemptId) {
        ExamAttempt attempt = loadOrThrow(attemptId);
        if (!attempt.isOwnedBy(principal.getId())) {
            throw new BusinessException(ErrorCode.ATTEMPT_NOT_OWNER);
        }
        return attempt;
    }

    private ExamAttempt loadOwnedOrAdmin(UserPrincipal principal, String attemptId) {
        ExamAttempt attempt = loadOrThrow(attemptId);
        if (RoleSeeder.ROLE_ADMIN.equals(principal.getRoleCode())) return attempt;
        if (attempt.isOwnedBy(principal.getId())) return attempt;
        throw new BusinessException(ErrorCode.ATTEMPT_NOT_OWNER);
    }
}
