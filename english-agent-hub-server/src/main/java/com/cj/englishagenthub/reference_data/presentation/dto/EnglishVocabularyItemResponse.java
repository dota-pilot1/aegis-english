package com.cj.englishagenthub.reference_data.presentation.dto;

import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyItem;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyMarker;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyEnrichment;
import com.cj.englishagenthub.reference_data.domain.VocabularyEnrichmentStatus;

import java.util.List;

public record EnglishVocabularyItemResponse(
        String id,
        int sortOrder,
        String letter,
        String headword,
        List<String> alternativeHeadwords,
        EnglishVocabularyMarker marker,
        String markerSymbol,
        String categoryLabel,
        String rawEntry,
        String meaningKo,
        String partOfSpeech,
        String exampleSentence,
        String exampleTranslation,
        VocabularyEnrichmentStatus enrichmentStatus,
        String curriculumVersion,
        String sourceSection,
        boolean active
) {
    public static EnglishVocabularyItemResponse from(EnglishVocabularyItem item) {
        return from(item, null);
    }

    public static EnglishVocabularyItemResponse from(EnglishVocabularyItem item, EnglishVocabularyEnrichment enrichment) {
        return new EnglishVocabularyItemResponse(
                item.getId(),
                item.getSortOrder(),
                item.getLetter(),
                item.getHeadword(),
                item.getAlternativeHeadwords(),
                item.getMarker(),
                item.getMarkerSymbol(),
                categoryLabel(item.getMarker()),
                item.getRawEntry(),
                enrichment == null ? null : enrichment.getMeaningKo(),
                enrichment == null ? null : enrichment.getPartOfSpeech(),
                enrichment == null ? null : enrichment.getExampleSentence(),
                enrichment == null ? null : enrichment.getExampleTranslation(),
                enrichment == null ? VocabularyEnrichmentStatus.EMPTY : enrichment.getStatus(),
                item.getCurriculumVersion(),
                item.getSourceSection(),
                item.isActive()
        );
    }

    private static String categoryLabel(EnglishVocabularyMarker marker) {
        return switch (marker) {
            case ELEMENTARY_RECOMMENDED -> "초등 권장";
            case COMMON_RECOMMENDED -> "중·고 공통";
            case ADVANCED_RECOMMENDED -> "고등 선택/심화";
        };
    }
}
