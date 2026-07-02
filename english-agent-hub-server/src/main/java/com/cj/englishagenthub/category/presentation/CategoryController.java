package com.cj.englishagenthub.category.presentation;

import com.cj.englishagenthub.category.application.CategoryService;
import com.cj.englishagenthub.category.presentation.dto.CategoryCreateRequest;
import com.cj.englishagenthub.category.presentation.dto.CategoryRenameRequest;
import com.cj.englishagenthub.category.presentation.dto.CategoryResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/question-categories")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Question Category", description = "문제은행 카테고리 트리 관리")
public class CategoryController {

    private final CategoryService categoryService;

    @GetMapping
    @Operation(summary = "카테고리 전체 목록 (flat, 프론트에서 트리 조립)")
    public List<CategoryResponse> list() {
        return categoryService.list();
    }

    @PostMapping
    @Operation(summary = "카테고리 생성 (parentId 없으면 루트)")
    public CategoryResponse create(@Valid @RequestBody CategoryCreateRequest req) {
        return categoryService.create(req);
    }

    @PutMapping("/{id}")
    @Operation(summary = "카테고리 이름 변경")
    public CategoryResponse rename(@PathVariable Long id, @Valid @RequestBody CategoryRenameRequest req) {
        return categoryService.rename(id, req);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "카테고리 삭제 (하위 카테고리/문제 있으면 409)")
    public ResponseEntity<Void> delete(@PathVariable Long id) {
        categoryService.delete(id);
        return ResponseEntity.noContent().build();
    }
}
