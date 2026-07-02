package com.cj.englishagenthub.reference_data.presentation;

import com.cj.englishagenthub.reference_data.application.EnglishVocabularyService;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyMarker;
import com.cj.englishagenthub.reference_data.presentation.dto.EnglishVocabularyItemResponse;
import com.cj.englishagenthub.reference_data.presentation.dto.EnglishVocabularyLimitResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/reference-data/english-vocabulary")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
@Tag(name = "Reference Data", description = "영어 기준정보 조회")
public class EnglishVocabularyController {

    private final EnglishVocabularyService vocabularyService;

    @GetMapping
    @Operation(summary = "영어 기본 어휘 목록 조회")
    public List<EnglishVocabularyItemResponse> list(
            @RequestParam(required = false) EnglishVocabularyMarker marker,
            @RequestParam(required = false) String keyword
    ) {
        return vocabularyService.list(marker, keyword);
    }

    @GetMapping("/limits")
    @Operation(summary = "영어 과목별 학습 어휘 수 기준 조회")
    public List<EnglishVocabularyLimitResponse> limits() {
        return vocabularyService.limits();
    }

    @PostMapping("/enrich")
    @Operation(summary = "영어 어휘 AI 보강 생성")
    public EnglishVocabularyService.EnrichmentBatchResult enrich(
            @RequestParam(required = false) EnglishVocabularyMarker marker,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "10") int limit
    ) {
        return vocabularyService.enrich(marker, keyword, limit);
    }

    @GetMapping("/enrichments/export")
    @Operation(summary = "영어 어휘 보강 seed JSON 내보내기")
    public List<EnglishVocabularyService.VocabularyEnrichmentSeedExport> exportEnrichmentSeeds() {
        return vocabularyService.exportEnrichmentSeeds();
    }
}
