package com.cj.englishagenthub.extraction.presentation;

import com.cj.englishagenthub.auth.security.UserPrincipal;
import com.cj.englishagenthub.extraction.application.ExtractedSheetService;
import com.cj.englishagenthub.extraction.presentation.dto.ExtractedSheetResponse;
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
@RequestMapping("/api/extracted-sheets")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Extracted Sheet", description = "PDF 추출 시험지 (검수 전 원본)")
public class ExtractedSheetController {

    private final ExtractedSheetService extractedSheetService;

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "PDF 업로드 → 독해 추출 → 추출 시험지로 저장")
    public ExtractedSheetResponse create(
            @AuthenticationPrincipal UserPrincipal principal,
            @RequestParam("file") MultipartFile file
    ) {
        return extractedSheetService.createFromPdf(principal, file);
    }

    @GetMapping
    @Operation(summary = "추출 시험지 목록 (카드)")
    public List<ExtractedSheetResponse> list() {
        return extractedSheetService.list();
    }

    @GetMapping("/{id}")
    @Operation(summary = "추출 시험지 단건 (문항 포함)")
    public ExtractedSheetResponse get(@PathVariable String id) {
        return extractedSheetService.get(id);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "추출 시험지 삭제")
    public ResponseEntity<Void> delete(@PathVariable String id) {
        extractedSheetService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
