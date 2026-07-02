package com.cj.englishagenthub.mathextraction.presentation;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.mathextraction.application.ExtractedMathSheetService;
import com.cj.englishagenthub.mathextraction.presentation.dto.ExtractedMathSheetResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/extracted-math-sheets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Extracted Math Sheet", description = "수학 PDF 이미지 추출 시험지 (검수 전 원본)")
public class ExtractedMathSheetController {

    private final ExtractedMathSheetService service;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "수학 PDF 업로드 → 문항 이미지 추출 → 추출 시험지로 저장")
    public ExtractedMathSheetResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "answerFile", required = false) MultipartFile answerFile
    ) {
        return service.createFromPdf(principal, file, answerFile);
    }

    @GetMapping
    @Operation(summary = "수학 추출 시험지 목록 (카드)")
    public List<ExtractedMathSheetResponse> list() {
        return service.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "수학 추출 시험지 단건 (문항 포함)")
    public ExtractedMathSheetResponse get(@PathVariable String id) {
        return service.get(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "수학 추출 시험지 삭제")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        service.delete(id);
        return ResponseEntity.noContent().build();
    }
}
