package com.cj.englishagenthub.mathextraction2.presentation;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.mathextraction2.application.StructuredMathJobService;
import com.cj.englishagenthub.mathextraction2.application.StructuredMathSheetService;
import com.cj.englishagenthub.mathextraction2.presentation.dto.StructuredMathJobResponse;
import com.cj.englishagenthub.mathextraction2.presentation.dto.StructuredMathSheetResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/structured-math-sheets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Structured Math Sheet", description = "수학 정형 추출(LaTeX+도형분리) 시험지")
public class StructuredMathSheetController {

    private final StructuredMathSheetService service;
    private final StructuredMathJobService jobService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "수학 PDF 업로드 → 비동기 정형 추출 잡 시작 (202 + jobId)")
    public ResponseEntity<Map<String, String>> create(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "answerFile", required = false) MultipartFile answerFile
    ) {
        try {
            byte[] problem = file.getBytes();
            byte[] answer = (answerFile != null && !answerFile.isEmpty()) ? answerFile.getBytes() : null;
            String jobId = jobService.submit(principal.getId(), problem, file.getOriginalFilename(), answer);
            return ResponseEntity.accepted().body(Map.of("jobId", jobId));
        } catch (IOException e) {
            throw new BusinessException(ErrorCode.EXTRACTION_PDF_READ_FAILED);
        }
    }

    @GetMapping("/jobs/{jobId}")
    @Operation(summary = "정형 추출 잡 상태 (폴링용)")
    public StructuredMathJobResponse jobStatus(@PathVariable String jobId) {
        StructuredMathJobService.Job job = jobService.get(jobId);
        if (job == null) throw new BusinessException(ErrorCode.EXTRACTED_MATH_SHEET_NOT_FOUND);
        return StructuredMathJobResponse.from(job);
    }

    @GetMapping
    @Operation(summary = "정형 추출 시험지 목록 (카드)")
    public List<StructuredMathSheetResponse> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "정형 추출 시험지 단건 (문항 포함)")
    public StructuredMathSheetResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "정형 추출 시험지 삭제")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
