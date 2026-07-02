package com.cj.englishagenthub.reference_data.application;

import com.cj.englishagenthub.ai.infrastructure.OpenAiClientResolver;
import com.cj.englishagenthub.common.exception.BusinessException;
import com.cj.englishagenthub.common.exception.ErrorCode;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyEnrichment;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyItem;
import com.cj.englishagenthub.reference_data.domain.EnglishVocabularyMarker;
import com.cj.englishagenthub.reference_data.infrastructure.EnglishVocabularyEnrichmentRepository;
import com.cj.englishagenthub.reference_data.infrastructure.EnglishVocabularyItemRepository;
import com.cj.englishagenthub.reference_data.infrastructure.EnglishVocabularyLimitRepository;
import com.cj.englishagenthub.reference_data.presentation.dto.EnglishVocabularyItemResponse;
import com.cj.englishagenthub.reference_data.presentation.dto.EnglishVocabularyLimitResponse;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.openai.OpenAiChatOptions;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EnglishVocabularyService {

    private final EnglishVocabularyItemRepository itemRepository;
    private final EnglishVocabularyLimitRepository limitRepository;
    private final EnglishVocabularyEnrichmentRepository enrichmentRepository;
    private final OpenAiClientResolver openAiClientResolver;

    private static final ObjectMapper objectMapper = new ObjectMapper();

    @Value("${openai.vocabulary-enrichment.model:${openai.translation.model:gpt-5-nano}}")
    private String enrichmentModel;

    @Transactional(readOnly = true)
    public List<EnglishVocabularyItemResponse> list(EnglishVocabularyMarker marker, String keyword) {
        List<EnglishVocabularyItem> items = marker == null
                ? itemRepository.findAllByOrderBySortOrderAsc()
                : itemRepository.findByMarkerOrderBySortOrderAsc(marker);

        String normalizedKeyword = StringUtils.hasText(keyword)
                ? keyword.trim().toLowerCase(Locale.ROOT)
                : null;

        Map<String, EnglishVocabularyEnrichment> enrichments = enrichmentRepository.findByVocabularyItemIn(items)
                .stream()
                .collect(Collectors.toMap(
                        enrichment -> enrichment.getVocabularyItem().getId(),
                        Function.identity()
                ));

        return items.stream()
                .filter(item -> matches(item, normalizedKeyword))
                .map(item -> EnglishVocabularyItemResponse.from(item, enrichments.get(item.getId())))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<EnglishVocabularyLimitResponse> limits() {
        return limitRepository.findAllByOrderBySortOrderAsc()
                .stream()
                .map(EnglishVocabularyLimitResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<VocabularyEnrichmentSeedExport> exportEnrichmentSeeds() {
        return enrichmentRepository.findAll()
                .stream()
                .filter(enrichment -> StringUtils.hasText(enrichment.getMeaningKo()))
                .map(enrichment -> new VocabularyEnrichmentSeedExport(
                        enrichment.getVocabularyItem().getCurriculumVersion(),
                        enrichment.getVocabularyItem().getHeadword(),
                        enrichment.getMeaningKo(),
                        enrichment.getPartOfSpeech(),
                        enrichment.getExampleSentence(),
                        enrichment.getExampleTranslation(),
                        enrichment.getGeneratedModel()
                ))
                .toList();
    }

    @Transactional
    public EnrichmentBatchResult enrich(EnglishVocabularyMarker marker, String keyword, int limit) {
        if (!openAiClientResolver.hasUsableKey()) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }
        ChatClient.Builder builder = openAiClientResolver.resolveChatClientBuilder();
        if (builder == null) {
            throw new BusinessException(ErrorCode.OPENAI_NOT_CONFIGURED);
        }

        List<EnglishVocabularyItem> candidates = (marker == null
                ? itemRepository.findAllByOrderBySortOrderAsc()
                : itemRepository.findByMarkerOrderBySortOrderAsc(marker))
                .stream()
                .filter(item -> matches(item, StringUtils.hasText(keyword) ? keyword.trim().toLowerCase(Locale.ROOT) : null))
                .filter(item -> {
                    EnglishVocabularyEnrichment enrichment = enrichmentRepository.findByVocabularyItem(item).orElse(null);
                    return enrichment == null || !StringUtils.hasText(enrichment.getMeaningKo());
                })
                .limit(Math.min(Math.max(limit, 1), 20))
                .toList();

        int completed = 0;
        for (EnglishVocabularyItem item : candidates) {
            GeneratedVocabularyEnrichment generated = generateOne(builder, item);
            EnglishVocabularyEnrichment enrichment = enrichmentRepository.findByVocabularyItem(item)
                    .orElseGet(() -> EnglishVocabularyEnrichment.createEmpty(item));
            enrichment.applyAiGenerated(
                    generated.meaningKo(),
                    generated.partOfSpeech(),
                    generated.exampleSentence(),
                    generated.exampleTranslation(),
                    enrichmentModel
            );
            enrichmentRepository.save(enrichment);
            completed++;
        }
        return new EnrichmentBatchResult(candidates.size(), completed);
    }

    private GeneratedVocabularyEnrichment generateOne(ChatClient.Builder builder, EnglishVocabularyItem item) {
        String content = builder.build()
                .prompt()
                .options(OpenAiChatOptions.builder()
                        .model(enrichmentModel)
                        .reasoningEffort("minimal")
                        .verbosity("low")
                        .maxCompletionTokens(700))
                .system("""
                        You are an editor of a Korean-English dictionary for Korean middle and high-school learners.
                        Return only valid JSON. Do not wrap it in markdown.
                        Schema:
                        {
                          "meaningKo": "Korean-English dictionary style meanings, 1-3 frequent senses, joined with comma",
                          "partOfSpeech": "Korean part of speech such as 명사, 동사, 형용사, 부사, 전치사, 접속사, 대명사, 관사, 한정사, 조동사",
                          "exampleSentence": "natural English example sentence for learners",
                          "exampleTranslation": "natural Korean translation of the example"
                        }
                        """)
                .user("""
                        Headword: %s
                        Raw curriculum entry: %s
                        Level label: %s
                        Write meaningKo as a headword definition, not a translation fitted only to the example sentence.
                        Do not translate literally. Use natural Korean expressions used in actual English-Korean dictionaries.
                        If there are multiple meanings, include only the most frequent 1-3 meanings.
                        Prefer dictionary-style expressions such as "~에 관하여", "~위에", "약 ~", "~쯤".
                        Prefer dictionary words like "풍부하다", "존재하다" over loose phrases like "많이 있다" when appropriate.
                        Use natural Korean suitable for Korean middle/high-school educational vocabulary books.
                        Write partOfSpeech in Korean. Use "/" for multiple parts of speech, for example 명사/동사.
                        """.formatted(
                        item.getHeadword(),
                        item.getRawEntry(),
                        EnglishVocabularyItemResponse.from(item).categoryLabel()
                ))
                .call()
                .content();

        try {
            GeneratedVocabularyEnrichment parsed = objectMapper.readValue(stripFence(content), GeneratedVocabularyEnrichment.class);
            if (!StringUtils.hasText(parsed.meaningKo()) || !StringUtils.hasText(parsed.partOfSpeech())) {
                throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
            }
            return parsed;
        } catch (JsonProcessingException e) {
            throw new BusinessException(ErrorCode.AI_REQUEST_FAILED);
        }
    }

    private String stripFence(String content) {
        if (content == null) return "";
        return content.replaceAll("(?s)^```(?:json)?\\s*", "")
                .replaceAll("(?s)\\s*```$", "")
                .trim();
    }

    private boolean matches(EnglishVocabularyItem item, String keyword) {
        if (keyword == null) return true;
        return contains(item.getHeadword(), keyword)
                || contains(item.getRawEntry(), keyword)
                || contains(item.getSourceSection(), keyword)
                || item.getAlternativeHeadwords().stream().anyMatch(value -> contains(value, keyword));
    }

    private boolean contains(String value, String keyword) {
        return value != null && value.toLowerCase(Locale.ROOT).contains(keyword);
    }

    public record EnrichmentBatchResult(int picked, int completed) {
    }

    public record VocabularyEnrichmentSeedExport(
            String curriculumVersion,
            String headword,
            String meaningKo,
            String partOfSpeech,
            String exampleSentence,
            String exampleTranslation,
            String generatedModel
    ) {
    }

    private record GeneratedVocabularyEnrichment(
            String meaningKo,
            String partOfSpeech,
            String exampleSentence,
            String exampleTranslation
    ) {
    }
}
