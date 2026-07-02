package com.cj.englishagenthub.reference_data.infrastructure;

import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface EnglishVocabularyItemRepository extends JpaRepository<EnglishVocabularyItem, String> {
    Optional<EnglishVocabularyItem> findByCurriculumVersionAndHeadword(String curriculumVersion, String headword);
    List<EnglishVocabularyItem> findAllByOrderBySortOrderAsc();
    List<EnglishVocabularyItem> findByMarkerOrderBySortOrderAsc(com.cj.englishagenthub.reference_data.domain.EnglishVocabularyMarker marker);
}
