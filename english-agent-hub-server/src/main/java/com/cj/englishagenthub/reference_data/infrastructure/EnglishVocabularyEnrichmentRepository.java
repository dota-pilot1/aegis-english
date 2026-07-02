package com.cj.englishagenthub.reference_data.infrastructure;

import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyEnrichment;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyItem;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EnglishVocabularyEnrichmentRepository extends JpaRepository<EnglishVocabularyEnrichment, String> {
    Optional<EnglishVocabularyEnrichment> findByVocabularyItem(EnglishVocabularyItem vocabularyItem);
    List<EnglishVocabularyEnrichment> findByVocabularyItemIn(Collection<EnglishVocabularyItem> vocabularyItems);
}
