package com.cj.englishagenthub.question.presentation;

import com.cj.englishagenthub.question.application.QuestionEmbeddingService;
import com.cj.englishagenthub.question.application.QuestionGenerationService;
import com.cj.englishagenthub.question.application.QuestionService;
import com.cj.englishagenthub.common.response.ErrorResponse;
import com.cj.englishagenthub.question.domain.QuestionDifficulty;
import com.cj.englishagenthub.question.presentation.dto.GenerateSimilarReadingQuestionRequest;
import com.cj.englishagenthub.question.presentation.dto.QuestionResponse;
import com.cj.englishagenthub.question.presentation.dto.QuestionUpsertRequest;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springdoc.core.annotations.ParameterObject;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/questions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Question Bank", description = "문제은행 저장 및 조회")
@SecurityRequirement(name = "bearerAuth")
public class QuestionController {

    private final QuestionService questionService;
    private final QuestionEmbeddingService questionEmbeddingService;
    private final QuestionGenerationService questionGenerationService;

    @GetMapping
    @Operation(
            summary = "문제 목록 조회",
            description = """
                    문제은행 목록을 페이지 단위로 조회한다.
                    categoryId를 지정하면 해당 카테고리와 하위 카테고리의 문항까지 포함한다.
                    difficulty는 easy, medium, hard 중 하나를 사용한다.
                    sort 예: createdAt,desc
                    """
    )
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "401", description = "인증 토큰 없음/만료", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "403", description = "ADMIN 권한 없음", content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public Page<QuestionResponse> list(
            @Parameter(description = "카테고리 ID. 지정 시 하위 카테고리 문항 포함", example = "1")
            @RequestParam(required = false) Long categoryId,
            @Parameter(description = "난이도", example = "medium")
            @RequestParam(required = false) QuestionDifficulty difficulty,
            @Parameter(description = "문제/지문/정답/해설/임베딩 텍스트 키워드 검색", example = "빈칸")
            @RequestParam(required = false) String keyword,
            @ParameterObject @PageableDefault(size = 50, sort = "createdAt", direction = Sort.Direction.DESC) Pageable pageable
    ) {
        return questionService.list(categoryId, difficulty, keyword, pageable);
    }

    @GetMapping("/{id}")
    @Operation(summary = "문제 단건 조회", description = "문제 ID로 문항 상세를 조회한다. 정답과 해설이 포함되는 관리자용 응답이다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "조회 성공"),
            @ApiResponse(responseCode = "404", description = "문제를 찾을 수 없음", content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public QuestionResponse get(@Parameter(description = "문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111") @PathVariable String id) {
        return questionService.get(id);
    }

    @PostMapping
    @Operation(summary = "문제 등록", description = "문제를 등록한다. 객관식은 choices 2개 이상이며 answer가 choices 중 하나와 정확히 일치해야 한다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "등록 성공"),
            @ApiResponse(responseCode = "400", description = "요청 검증 실패", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "카테고리를 찾을 수 없음", content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public QuestionResponse create(@Valid @RequestBody QuestionUpsertRequest req) {
        return questionService.create(req);
    }

    @PutMapping("/{id}")
    @Operation(summary = "문제 수정", description = "문제를 수정한다. 임베딩 대상 텍스트가 바뀌면 embeddingStatus가 PENDING으로 전환된다.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "수정 성공"),
            @ApiResponse(responseCode = "400", description = "요청 검증 실패", content = @Content(schema = @Schema(implementation = ErrorResponse.class))),
            @ApiResponse(responseCode = "404", description = "문제 또는 카테고리를 찾을 수 없음", content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public QuestionResponse update(
            @Parameter(description = "문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111") @PathVariable String id,
            @Valid @RequestBody QuestionUpsertRequest req
    ) {
        return questionService.update(id, req);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "문제 삭제")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "삭제 성공"),
            @ApiResponse(responseCode = "404", description = "문제를 찾을 수 없음", content = @Content(schema = @Schema(implementation = ErrorResponse.class)))
    })
    public ResponseEntity<Void> delete(@Parameter(description = "문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111") @PathVariable String id) {
        questionService.delete(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/embed-pending")
    @Operation(summary = "PENDING/FAILED 문제 배치 임베딩", description = "임베딩 대기/실패 상태 문항을 OpenAI 임베딩 모델로 일괄 처리한다.")
    public QuestionEmbeddingService.EmbeddingBatchResult embedPending(
            @Parameter(description = "카테고리 ID. 지정 시 하위 카테고리 포함", example = "1")
            @RequestParam(required = false) Long categoryId,
            @Parameter(description = "처리할 최대 문항 수", example = "50")
            @RequestParam(defaultValue = "50") int limit
    ) {
        return questionEmbeddingService.embedPending(categoryId, limit);
    }

    @PostMapping("/{id}/embed")
    @Operation(summary = "문제 단건 임베딩", description = "지정한 문항 1건의 embeddingText를 임베딩 벡터로 변환한다.")
    public QuestionResponse embedOne(@Parameter(description = "문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111") @PathVariable String id) {
        return questionEmbeddingService.embedOne(id);
    }

    @GetMapping("/{id}/similar")
    @Operation(summary = "유사 문제 Top N 조회", description = "pgvector 코사인 유사도 기준으로 비슷한 문항을 조회한다. 대상 문항은 임베딩 완료 상태여야 한다.")
    public List<QuestionEmbeddingService.SimilarQuestion> findSimilar(
            @Parameter(description = "문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111") @PathVariable String id,
            @Parameter(description = "조회할 유사 문항 수", example = "10") @RequestParam(defaultValue = "10") int limit
    ) {
        return questionEmbeddingService.findSimilar(id, limit);
    }

    @PostMapping("/{id}/generate-similar-reading")
    @Operation(summary = "독해 템플릿 기반 유사 문제 생성", description = "기존 독해 문항을 소스로 사용해 유사 독해 문항 초안을 생성한다. 반환값은 저장 전 QuestionUpsertRequest 목록이다.")
    public List<QuestionUpsertRequest> generateSimilarReadingQuestions(
            @Parameter(description = "소스 문제 ID", example = "018f6d7e-2c88-7c2a-bcb1-91f9012bc111") @PathVariable String id,
            @Valid @RequestBody GenerateSimilarReadingQuestionRequest request
    ) {
        return questionGenerationService.generateSimilarReadingQuestions(id, request);
    }

    @PostMapping("/generate-similar-reading")
    @Operation(summary = "독해 템플릿 샘플 기반 유사 문제 생성", description = "요청 본문에 포함된 샘플 템플릿 정보를 기준으로 유사 독해 문항 초안을 생성한다.")
    public List<QuestionUpsertRequest> generateSimilarReadingQuestions(
            @Valid @RequestBody GenerateSimilarReadingQuestionRequest request
    ) {
        return questionGenerationService.generateSimilarReadingQuestions(request);
    }

    @GetMapping("/embedding-status")
    @Operation(summary = "임베딩 상태별 문제 수 조회", description = "PENDING/COMPLETED/FAILED 상태별 문항 수를 조회한다.")
    public QuestionEmbeddingService.EmbeddingCounts embeddingStatus(
            @Parameter(description = "카테고리 ID. 지정 시 하위 카테고리 포함", example = "1")
            @RequestParam(required = false) Long categoryId
    ) {
        return questionEmbeddingService.counts(categoryId);
    }
}
