package com.cj.englishagenthub.exam.presentation;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.exam.application.ExamService;
import com.cj.englishagenthub.exam.application.ExamVariantService;
import com.cj.englishagenthub.exam.presentation.dto.ExamResponse;
import com.cj.englishagenthub.exam.presentation.dto.ExamUpsertRequest;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exams")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Exam", description = "시험지 출제 및 관리")
public class ExamController {

    private final ExamService examService;
    private final ExamVariantService examVariantService;

    @GetMapping
    @Operation(summary = "시험지 목록")
    public List<ExamResponse> list() {
        return examService.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "시험지 단건 (문항 포함)")
    public ExamResponse get(@PathVariable String id) {
        return examService.get(id);
    }

    @PostMapping
    @Operation(summary = "시험지 생성")
    public ExamResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @Valid @RequestBody ExamUpsertRequest req
    ) {
        return examService.create(principal, req);
    }

    @PutMapping("/{id}")
    @Operation(summary = "시험지 수정 (DRAFT만)")
    public ExamResponse update(@PathVariable String id, @Valid @RequestBody ExamUpsertRequest req) {
        return examService.update(id, req);
    }

    @PostMapping("/{id}/generate-variant")
    @Operation(summary = "시험지 통째 유사 변형 (새 DRAFT 시험지 생성)")
    public ExamResponse generateVariant(
            @AuthenticationPrincipal UserPrincipal principal,
            @PathVariable String id
    ) {
        return examVariantService.generateVariant(principal, id);
    }

    @PostMapping("/{id}/publish")
    @Operation(summary = "시험지 발행")
    public ExamResponse publish(@PathVariable String id) {
        return examService.publish(id);
    }

    @PostMapping("/{id}/close")
    @Operation(summary = "시험지 마감")
    public ExamResponse close(@PathVariable String id) {
        return examService.close(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "시험지 삭제")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        examService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
