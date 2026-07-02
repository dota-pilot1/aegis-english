package com.cj.englishagenthub.reference_data.presentation.dto;

import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyLimit;

public record EnglishVocabularyLimitResponse(
        String id,
        String curriculumVersion,
        String schoolLevel,
        String subjectGroup,
        String subjectName,
        int wordLimit,
        String note,
        int sortOrder
) {
    public static EnglishVocabularyLimitResponse from(EnglishVocabularyLimit limit) {
        return new EnglishVocabularyLimitResponse(
                limit.getId(),
                limit.getCurriculumVersion(),
                limit.getSchoolLevel(),
                limit.getSubjectGroup(),
                limit.getSubjectName(),
                limit.getWordLimit(),
                limit.getNote(),
                limit.getSortOrder()
        );
    }
}
