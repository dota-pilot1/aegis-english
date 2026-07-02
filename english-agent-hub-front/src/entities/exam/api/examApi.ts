import { api } from "@/shared/api/axios";
import type { QuestionDifficulty, QuestionType } from "@/entities/question/api/questionApi";

export type ExamStatus = "DRAFT" | "PUBLISHED" | "CLOSED";
export type AttemptStatus = "IN_PROGRESS" | "SUBMITTED";

export type ExamItemResponse = {
  questionId: string;
  orderNo: number;
  points: number;
  questionType: QuestionType;
  difficulty: QuestionDifficulty;
  categoryPath: string[];
  question: string;
  passage: string | null;
  choices: string[];
  answer: string;
  explanation: string;
};

export type ExamResponse = {
  id: string;
  title: string;
  description: string | null;
  subjectId: number | null;
  subjectName: string | null;
  examCategoryId: number | null;
  examCategoryName: string | null;
  status: ExamStatus;
  timeLimitMinutes: number | null;
  totalPoints: number;
  itemCount: number;
  createdById: number;
  createdByName: string;
  items: ExamItemResponse[];
  createdAt: string;
  updatedAt: string;
};

export type ExamUpsertRequest = {
  title: string;
  description?: string;
  timeLimitMinutes?: number | null;
  subjectId?: number | null;
  examCategoryId?: number | null;
  items: { questionId: string; points: number }[];
};

export type ExamCategoryRecord = {
  id: number;
  parentId: number | null;
  name: string;
  displayOrder: number;
  examCount: number;
};

export type ExamCategoryNode = ExamCategoryRecord & {
  children: ExamCategoryNode[];
  subtreeCount: number;
};

export type TakeItem = {
  questionId: string;
  orderNo: number;
  questionType: QuestionType;
  question: string;
  passage: string | null;
  choices: string[];
  maxPoints: number;
};

export type ExamTakeResponse = {
  attemptId: string;
  examId: string;
  title: string;
  description: string | null;
  timeLimitMinutes: number | null;
  maxScore: number;
  startedAt: string;
  items: TakeItem[];
};

export type AttemptResultItem = {
  questionId: string;
  orderNo: number;
  questionType: QuestionType;
  question: string;
  passage: string | null;
  choices: string[];
  submittedAnswer: string | null;
  correctAnswer: string;
  correct: boolean | null;
  earnedPoints: number;
  maxPoints: number;
  explanation: string;
  requiresReview: boolean;
};

export type AttemptResultResponse = {
  attemptId: string;
  examId: string;
  examTitle: string;
  status: AttemptStatus;
  totalScore: number;
  maxScore: number;
  requiresReview: boolean;
  submittedAt: string | null;
  items: AttemptResultItem[];
};

export type AttemptSummaryResponse = {
  attemptId: string;
  examId: string;
  examTitle: string;
  examineeId: number;
  examineeName: string;
  status: AttemptStatus;
  totalScore: number;
  maxScore: number;
  requiresReview: boolean;
  startedAt: string;
  submittedAt: string | null;
};

export type AttemptSubmitRequest = {
  answers: { questionId: string; answer: string }[];
};

export const examApi = {
  list: () => api.get<ExamResponse[]>("/api/exams").then((r) => r.data),
  listPublished: () => api.get<ExamResponse[]>("/api/practice/exams").then((r) => r.data),
  get: (id: string) => api.get<ExamResponse>(`/api/exams/${id}`).then((r) => r.data),
  create: (body: ExamUpsertRequest) =>
    api.post<ExamResponse>("/api/exams", body).then((r) => r.data),
  update: (id: string, body: ExamUpsertRequest) =>
    api.put<ExamResponse>(`/api/exams/${id}`, body).then((r) => r.data),
  generateVariant: (id: string) =>
    api.post<ExamResponse>(`/api/exams/${id}/generate-variant`).then((r) => r.data),
  publish: (id: string) => api.post<ExamResponse>(`/api/exams/${id}/publish`).then((r) => r.data),
  close: (id: string) => api.post<ExamResponse>(`/api/exams/${id}/close`).then((r) => r.data),
  delete: (id: string) => api.delete<void>(`/api/exams/${id}`).then(() => undefined),
};

export const examCategoryApi = {
  list: () => api.get<ExamCategoryRecord[]>("/api/exam-categories").then((r) => r.data),
};

export const buildExamCategoryTree = (flat: ExamCategoryRecord[]): ExamCategoryNode[] => {
  const map = new Map<number, ExamCategoryNode>();
  flat.forEach((record) => map.set(record.id, { ...record, children: [], subtreeCount: 0 }));

  const roots: ExamCategoryNode[] = [];
  map.forEach((node) => {
    if (node.parentId === null || !map.has(node.parentId)) {
      roots.push(node);
    } else {
      map.get(node.parentId)!.children.push(node);
    }
  });

  const fill = (node: ExamCategoryNode): number => {
    node.subtreeCount = node.examCount + node.children.reduce((sum, child) => sum + fill(child), 0);
    return node.subtreeCount;
  };
  roots.forEach(fill);

  const sortRec = (nodes: ExamCategoryNode[]) => {
    nodes.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    nodes.forEach((node) => sortRec(node.children));
  };
  sortRec(roots);
  return roots;
};

export const flattenExamCategoryTree = (
  roots: ExamCategoryNode[],
): { id: number; depth: number; name: string; pathLabel: string }[] => {
  const out: { id: number; depth: number; name: string; pathLabel: string }[] = [];
  const walk = (node: ExamCategoryNode, depth: number, path: string[]) => {
    const current = [...path, node.name];
    out.push({ id: node.id, depth, name: node.name, pathLabel: current.join(" > ") });
    node.children.forEach((child) => walk(child, depth + 1, current));
  };
  roots.forEach((root) => walk(root, 0, []));
  return out;
};

export const attemptApi = {
  start: (examId: string) =>
    api.post<ExamTakeResponse>(`/api/attempts/start/${examId}`).then((r) => r.data),
  take: (attemptId: string) =>
    api.get<ExamTakeResponse>(`/api/attempts/${attemptId}/take`).then((r) => r.data),
  submit: (attemptId: string, body: AttemptSubmitRequest) =>
    api.post<AttemptResultResponse>(`/api/attempts/${attemptId}/submit`, body).then((r) => r.data),
  result: (attemptId: string) =>
    api.get<AttemptResultResponse>(`/api/attempts/${attemptId}/result`).then((r) => r.data),
  myAttempts: () =>
    api.get<AttemptSummaryResponse[]>("/api/attempts/me").then((r) => r.data),
  ofExam: (examId: string) =>
    api.get<AttemptSummaryResponse[]>(`/api/attempts/exam/${examId}`).then((r) => r.data),
  delete: (attemptId: string) =>
    api.delete<void>(`/api/attempts/${attemptId}`).then(() => undefined),
};
