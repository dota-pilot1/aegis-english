import { api } from "@/shared/api/axios";

export type EnglishVocabularyMarker =
  | "ELEMENTARY_RECOMMENDED"
  | "COMMON_RECOMMENDED"
  | "ADVANCED_RECOMMENDED";

export type EnglishVocabularyItem = {
  id: string;
  sortOrder: number;
  letter: string;
  headword: string;
  alternativeHeadwords: string[];
  marker: EnglishVocabularyMarker;
  markerSymbol: string | null;
  categoryLabel: string;
  rawEntry: string;
  meaningKo: string | null;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  enrichmentStatus: "EMPTY" | "AI_GENERATED" | "REVIEWED" | "REJECTED";
  curriculumVersion: string;
  sourceSection: string;
  active: boolean;
};

export type EnglishVocabularyLimit = {
  id: string;
  curriculumVersion: string;
  schoolLevel: string;
  subjectGroup: string;
  subjectName: string;
  wordLimit: number;
  note: string | null;
  sortOrder: number;
};

export type EnglishVocabularyListParams = {
  marker?: EnglishVocabularyMarker;
  keyword?: string;
};

export type VocabularyEnrichmentBatchResult = {
  picked: number;
  completed: number;
};

export type VocabularyEnrichmentSeedExport = {
  curriculumVersion: string;
  headword: string;
  meaningKo: string;
  partOfSpeech: string | null;
  exampleSentence: string | null;
  exampleTranslation: string | null;
  generatedModel: string | null;
};

export const englishVocabularyApi = {
  list: (params: EnglishVocabularyListParams = {}) =>
    api
      .get<EnglishVocabularyItem[]>("/api/reference-data/english-vocabulary", {
        params: Object.fromEntries(
          Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
        ),
      })
      .then((r) => r.data),
  limits: () =>
    api
      .get<EnglishVocabularyLimit[]>("/api/reference-data/english-vocabulary/limits")
      .then((r) => r.data),
  enrich: (params: EnglishVocabularyListParams & { limit?: number } = {}) =>
    api
      .post<VocabularyEnrichmentBatchResult>(
        "/api/reference-data/english-vocabulary/enrich",
        undefined,
        {
          params: Object.fromEntries(
            Object.entries(params).filter(([, value]) => value !== undefined && value !== "")
          ),
        },
      )
      .then((r) => r.data),
  exportEnrichmentSeeds: () =>
    api
      .get<VocabularyEnrichmentSeedExport[]>(
        "/api/reference-data/english-vocabulary/enrichments/export",
      )
      .then((r) => r.data),
};
