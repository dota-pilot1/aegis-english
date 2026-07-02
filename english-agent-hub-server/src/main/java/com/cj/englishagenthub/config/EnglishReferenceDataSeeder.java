package com.cj.englishagenthub.config;

import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyItem;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyLimit;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyMarker;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyEnrichment;
import com.cj.englishagenthub.reference_data.infrastructure.EnglishVocabularyItemRepository;
import com.cj.englishagenthub.reference_data.infrastructure.EnglishVocabularyLimitRepository;
import com.cj.englishagenthub.reference_data.infrastructure.EnglishVocabularyEnrichmentRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.core.annotation.Order;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.util.List;

@Slf4j
@Component
@Order(6)
@RequiredArgsConstructor
public class EnglishReferenceDataSeeder implements ApplicationRunner {

    private static final String VOCABULARY_SEED = "seed/english-vocabulary-2022.json";
    private static final String VOCABULARY_LIMIT_SEED = "seed/english-vocabulary-limits-2022.json";
    private static final String VOCABULARY_ENRICHMENT_SEED = "seed/english-vocabulary-enrichments-2022.json";

    private final EnglishVocabularyItemRepository vocabularyItemRepository;
    private final EnglishVocabularyLimitRepository vocabularyLimitRepository;
    private final EnglishVocabularyEnrichmentRepository vocabularyEnrichmentRepository;
    private final ObjectMapper objectMapper = new ObjectMapper();

    private record VocabularyItemSeed(
            int sortOrder,
            String letter,
            String headword,
            List<String> alternativeHeadwords,
            EnglishVocabularyMarker marker,
            String markerSymbol,
            String rawEntry,
            String curriculumVersion,
            String sourceSection
    ) {
    }

    private record VocabularyLimitSeed(
            String curriculumVersion,
            String schoolLevel,
            String subjectGroup,
            String subjectName,
            int wordLimit,
            String note,
            int sortOrder
    ) {
    }

    private record VocabularyEnrichmentSeed(
            String curriculumVersion,
            String headword,
            String meaningKo,
            String partOfSpeech,
            String exampleSentence,
            String exampleTranslation,
            String generatedModel
    ) {
    }

    @Override
    @Transactional
    public void run(ApplicationArguments args) throws Exception {
        seedVocabularyItems();
        seedVocabularyLimits();
        seedVocabularyEnrichments();
    }

    private void seedVocabularyItems() throws IOException {
        List<VocabularyItemSeed> seeds = objectMapper.readValue(
                new ClassPathResource(VOCABULARY_SEED).getInputStream(),
                new TypeReference<>() {
                }
        );

        int created = 0;
        int updated = 0;
        for (VocabularyItemSeed seed : seeds) {
            EnglishVocabularyItem item = vocabularyItemRepository
                    .findByCurriculumVersionAndHeadword(seed.curriculumVersion(), seed.headword())
                    .orElse(null);
            if (item == null) {
                vocabularyItemRepository.save(EnglishVocabularyItem.create(
                        seed.curriculumVersion(),
                        seed.sortOrder(),
                        seed.letter(),
                        seed.headword(),
                        seed.alternativeHeadwords(),
                        seed.marker(),
                        seed.markerSymbol(),
                        seed.rawEntry(),
                        seed.sourceSection()
                ));
                created++;
            } else {
                item.update(
                        seed.curriculumVersion(),
                        seed.sortOrder(),
                        seed.letter(),
                        seed.headword(),
                        seed.alternativeHeadwords(),
                        seed.marker(),
                        seed.markerSymbol(),
                        seed.rawEntry(),
                        seed.sourceSection()
                );
                updated++;
            }
        }
        log.info("Seeded English vocabulary items: created={}, updated={}, total={}", created, updated, seeds.size());
    }

    private void seedVocabularyLimits() throws IOException {
        List<VocabularyLimitSeed> seeds = objectMapper.readValue(
                new ClassPathResource(VOCABULARY_LIMIT_SEED).getInputStream(),
                new TypeReference<>() {
                }
        );

        int created = 0;
        int updated = 0;
        for (VocabularyLimitSeed seed : seeds) {
            EnglishVocabularyLimit limit = vocabularyLimitRepository
                    .findByCurriculumVersionAndSubjectName(seed.curriculumVersion(), seed.subjectName())
                    .orElse(null);
            if (limit == null) {
                vocabularyLimitRepository.save(EnglishVocabularyLimit.create(
                        seed.curriculumVersion(),
                        seed.schoolLevel(),
                        seed.subjectGroup(),
                        seed.subjectName(),
                        seed.wordLimit(),
                        seed.note(),
                        seed.sortOrder()
                ));
                created++;
            } else {
                limit.update(
                        seed.curriculumVersion(),
                        seed.schoolLevel(),
                        seed.subjectGroup(),
                        seed.subjectName(),
                        seed.wordLimit(),
                        seed.note(),
                        seed.sortOrder()
                );
                updated++;
            }
        }
        log.info("Seeded English vocabulary limits: created={}, updated={}, total={}", created, updated, seeds.size());
    }

    private void seedVocabularyEnrichments() throws IOException {
        ClassPathResource resource = new ClassPathResource(VOCABULARY_ENRICHMENT_SEED);
        if (!resource.exists()) {
            log.info("English vocabulary enrichment seed not found: {}", VOCABULARY_ENRICHMENT_SEED);
            return;
        }

        List<VocabularyEnrichmentSeed> seeds = objectMapper.readValue(
                resource.getInputStream(),
                new TypeReference<>() {
                }
        );

        int created = 0;
        int updated = 0;
        int skipped = 0;
        for (VocabularyEnrichmentSeed seed : seeds) {
            EnglishVocabularyItem item = vocabularyItemRepository
                    .findByCurriculumVersionAndHeadword(seed.curriculumVersion(), seed.headword())
                    .orElse(null);
            if (item == null) {
                skipped++;
                continue;
            }

            EnglishVocabularyEnrichment enrichment = vocabularyEnrichmentRepository
                    .findByVocabularyItem(item)
                    .orElse(null);
            boolean isCreated = false;
            if (enrichment == null) {
                enrichment = EnglishVocabularyEnrichment.createEmpty(item);
                isCreated = true;
                created++;
            } else if (enrichment.hasSameAiGeneratedContent(
                    seed.meaningKo(),
                    seed.partOfSpeech(),
                    seed.exampleSentence(),
                    seed.exampleTranslation(),
                    seed.generatedModel()
            )) {
                skipped++;
                continue;
            }
            enrichment.applyAiGenerated(
                    seed.meaningKo(),
                    seed.partOfSpeech(),
                    seed.exampleSentence(),
                    seed.exampleTranslation(),
                    seed.generatedModel()
            );
            vocabularyEnrichmentRepository.save(enrichment);
            if (!isCreated) {
                updated++;
            }
        }
        log.info("Seeded English vocabulary enrichments: created={}, updated={}, skipped={}, total={}", created, updated, skipped, seeds.size());
    }
}
