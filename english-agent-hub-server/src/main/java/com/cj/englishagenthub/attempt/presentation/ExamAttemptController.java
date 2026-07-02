package com.cj.englishagenthub.attempt.presentation;

import com.cj.englishagenthub.attempt.application.ExamAttemptService;
import com.cj.englishagenthub.attempt.presentation.dto.AttemptResultResponse;
import com.cj.englishagenthub.attempt.presentation.dto.AttemptSubmitRequest;
import com.cj.englishagenthub.attempt.presentation.dto.AttemptSummaryResponse;
import com.cj.englishagenthub.attempt.presentation.dto.ExamTakeResponse;
import com.cj.englishagenthub.auth.security.UserPrincipal;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attempts")
@RequiredArgsConstructor
@Tag(name = "Exam Attempt", description = "시험 응시 및 채점")
public class ExamAttemptController {

    private final ExamAttemptService attemptService;

    @PostMapping("/start/{examId}")
    @Operation(summary = "응시 시작 (진행 중이면 이어서)")
    public ExamTakeResponse start(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String examId
    ) {
        return attemptService.startOrResume(principal, examId);
    }

    @GetMapping("/{attemptId}/take")
    @Operation(summary = "응시 화면 조회 (정답 미포함)")
    public ExamTakeResponse take(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String attemptId
    ) {
        return attemptService.getTake(principal, attemptId);
    }

    @PostMapping("/{attemptId}/submit")
    @Operation(summary = "답안 제출 및 자동 채점")
    public AttemptResultResponse submit(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String attemptId,
            @Valid @RequestBody AttemptSubmitRequest req
    ) {
        return attemptService.submit(principal, attemptId, req);
    }

    @GetMapping("/{attemptId}/result")
    @Operation(summary = "채점 결과 조회 (본인 또는 관리자)")
    public AttemptResultResponse result(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String attemptId
    ) {
        return attemptService.getResult(principal, attemptId);
    }

    @GetMapping("/me")
    @Operation(summary = "내 응시 이력")
    public List<AttemptSummaryResponse> myAttempts(@AuthenticationPrincipal UserPrincipal principal) {
        return attemptService.myAttempts(principal);
    }

    @GetMapping("/exam/{examId}")
    @PreAuthorize("hasRole('ADMIN')")
    @Operation(summary = "특정 시험의 응시 이력 (관리자)")
    public List<AttemptSummaryResponse> attemptsOfExam(@PathVariable String examId) {
        return attemptService.attemptsOfExam(examId);
    }

    @DeleteMapping("/{attemptId}")
    @PreAuthorize("hasRole('ADMIN')")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(summary = "응시 기록 삭제 (관리자)")
    public void deleteAttempt(@PathVariable String attemptId) {
        attemptService.delete(attemptId);
    }
}
