import { api } from "@/shared/api/axios";

export type QuestionDifficulty = "easy" | "medium" | "hard";

export type QuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER";

export type EmbeddingStatus = "PENDING" | "COMPLETED" | "FAILED";

export type QuestionArea = "듣기" | "읽기" | "어휘/어법" | "간접 쓰기" | "장문";

export type QuestionKind =
  | "GENERAL"
  | "LISTENING_PURPOSE_OPINION"
  | "LISTENING_RELATION_PLACE"
  | "LISTENING_VISUAL_CHART"
  | "LISTENING_TASK_REASON"
  | "LISTENING_DETAIL"
  | "LISTENING_LONG_TALK"
  | "MAIN_IDEA"
  | "PURPOSE"
  | "CLAIM"
  | "GIST"
  | "TOPIC"
  | "TITLE"
  | "DETAIL_CHART"
  | "DETAIL_MATCH"
  | "PRACTICAL_TEXT"
  | "VOCAB_CONTEXT"
  | "VOCAB_UNDERLINED"
  | "GRAMMAR_CHECK"
  | "BLANK_WORD"
  | "BLANK_PHRASE"
  | "BLANK_SENTENCE"
  | "IRRELEVANT_SENTENCE"
  | "ORDERING"
  | "SENTENCE_INSERTION"
  | "SUMMARY_COMPLETION"
  | "LONG_READING_SET"
  | "COMPOSITE_READING";

export type QuestionSourceType = "UNKNOWN" | "CSAT" | "MOCK" | "CUSTOM";

export type QuestionResponse = {
  id: string;
  questionType: QuestionType;
  questionKind: QuestionKind;
  sourceType: QuestionSourceType;
  sourceName: string | null;
  categoryId: number;
  categoryPath: string[];
  area: QuestionArea | null;
  listening: boolean;
  difficulty: QuestionDifficulty;
  question: string;
  passage?: string | null;
  choices: string[];
  answer: string;
  explanation: string;
  keywords: string[];
  embeddingText: string;
  embeddingStatus: EmbeddingStatus;
  embeddingModel: string | null;
  embeddedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type EmbeddingBatchResult = {
  picked: number;
  completed: number;
  failed: number;
  stillPending: number;
};

export type EmbeddingStatusResponse = {
  pending: number;
  completed: number;
  failed: number;
};

export type SimilarQuestion = {
  question: QuestionResponse;
  similarity: number;
};

export type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};

export type QuestionUpsertRequest = {
  questionType: QuestionType;
  questionKind?: QuestionKind | null;
  sourceType?: QuestionSourceType | null;
  sourceName?: string | null;
  categoryId: number | null;
  difficulty: QuestionDifficulty;
  question: string;
  passage?: string | null;
  choices?: string[];
  answer: string;
  explanation: string;
  keywords?: string[];
  embeddingText?: string;
};

export type QuestionListParams = {
  categoryId?: number;
  difficulty?: QuestionDifficulty | "";
  keyword?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export type GenerateSimilarReadingQuestionRequest = {
  templateId: string;
  templateTitle: string;
  subtype: string;
  rules: string[];
  count: number;
  difficulty: QuestionDifficulty | "source";
  choiceCount: number;
  includeExplanation: boolean;
  keepTopic: boolean;
  avoidDuplicate: boolean;
  categoryId?: number;
  categoryPath?: string;
  sourceDifficulty?: QuestionDifficulty;
  sourceQuestion?: string;
  sourcePassage?: string;
  sourceChoices?: string[];
  sourceAnswer?: string;
  sourceExplanation?: string;
  sourceKeywords?: string[];
};

export const questionApi = {
  list: (params: QuestionListParams = {}) =>
    api
      .get<PageResponse<QuestionResponse> | QuestionResponse[]>("/api/questions", {
        params: Object.fromEntries(
          Object.entries({ size: 1000, sort: "createdAt,desc", ...params }).filter(
            ([, value]) => value !== undefined && value !== "",
          )
        ),
      })
      .then((r) => (Array.isArray(r.data) ? r.data : r.data.content)),
  create: (body: QuestionUpsertRequest) =>
    api.post<QuestionResponse>("/api/questions", body).then((r) => r.data),
  update: (id: string, body: QuestionUpsertRequest) =>
    api.put<QuestionResponse>(`/api/questions/${id}`, body).then((r) => r.data),
  delete: (id: string) => api.delete<void>(`/api/questions/${id}`).then(() => undefined),
  embedPending: (limit = 50, categoryId?: number) =>
    api
      .post<EmbeddingBatchResult>(`/api/questions/embed-pending`, undefined, {
        params: { limit, ...(categoryId != null ? { categoryId } : {}) },
      })
      .then((r) => r.data),
  embedOne: (id: string) =>
    api.post<QuestionResponse>(`/api/questions/${id}/embed`).then((r) => r.data),
  embeddingStatus: (categoryId?: number) =>
    api
      .get<EmbeddingStatusResponse>(`/api/questions/embedding-status`, {
        params: categoryId != null ? { categoryId } : {},
      })
      .then((r) => r.data),
  findSimilar: (id: string, limit = 10) =>
    api
      .get<SimilarQuestion[]>(`/api/questions/${id}/similar`, { params: { limit } })
      .then((r) => r.data),
  generateSimilarReading: (id: string, body: GenerateSimilarReadingQuestionRequest) =>
    api
      .post<QuestionUpsertRequest[]>(`/api/questions/${id}/generate-similar-reading`, body)
      .then((r) => r.data),
  generateSimilarReadingFromTemplate: (body: GenerateSimilarReadingQuestionRequest) =>
    api
      .post<QuestionUpsertRequest[]>(`/api/questions/generate-similar-reading`, body)
      .then((r) => r.data),
};
