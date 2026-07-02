package com.cj.englishagenthub.exam_category.presentation;

import com.cj.englishagenthub.exam_category.application.ExamCategoryService;
import com.cj.englishagenthub.exam_category.presentation.dto.ExamCategoryCreateRequest;
import com.cj.englishagenthub.exam_category.presentation.dto.ExamCategoryRenameRequest;
import com.cj.englishagenthub.exam_category.presentation.dto.ExamCategoryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/exam-categories")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Exam Category", description = "시험지 분류 트리 관리")
public class ExamCategoryController {

    private final ExamCategoryService examCategoryService;

    @GetMapping
    @Operation(summary = "시험지 분류 전체 목록")
    public List<ExamCategoryResponse> list() {
        return examCategoryService.list();
    }

    @PostMapping
    @Operation(summary = "시험지 분류 생성")
    public ExamCategoryResponse create(@Valid @RequestBody ExamCategoryCreateRequest req) {
        return examCategoryService.create(req);
    }

    @PutMapping("/{id}")
    @Operation(summary = "시험지 분류 이름 변경")
    public ExamCategoryResponse rename(@PathVariable Long id, @Valid @RequestBody ExamCategoryRenameRequest req) {
        return examCategoryService.rename(id, req);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "시험지 분류 삭제")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        examCategoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
