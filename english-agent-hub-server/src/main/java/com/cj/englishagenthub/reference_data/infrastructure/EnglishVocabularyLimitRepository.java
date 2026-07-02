package com.cj.englishagenthub.reference_data.infrastructure;

import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyLimit;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnglishVocabularyLimitRepository extends JpaRepository<EnglishVocabularyLimit, String> {
    Optional<EnglishVocabularyLimit> findByCurriculumVersionAndSubjectName(String curriculumVersion, String subjectName);
    List<EnglishVocabularyLimit> findAllByOrderBySortOrderAsc();
}
