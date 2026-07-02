import { api } from "@/shared/api/axios";

export type ExtractedSheetItem = {
  questionNumber: number | null;
  prompt: string;
  passage: string | null;
  choices: string[];
  /** LLM이 판단한 정답 (보기 중 하나). 검수 권장. */
  answer: string | null;
  /** LLM이 생성한 해설. */
  explanation: string | null;
  type: string;
};

export type ExtractedSheet = {
  id: string;
  title: string;
  sourceFileName: string | null;
  itemCount: number;
  createdByName: string;
  createdAt: string;
  /** 목록(카드)에서는 빈 배열, 상세에서는 채워짐 */
  items: ExtractedSheetItem[];
};

export const extractedSheetApi = {
  list: () => api.get<ExtractedSheet[]>("/api/extracted-sheets").then((r) => r.data),
  get: (id: string) => api.get<ExtractedSheet>(`/api/extracted-sheets/${id}`).then((r) => r.data),
  create: (file: File) => {
    const form = new FormData();
    form.append("file", file);
    // 추출은 PDF 파싱 + LLM 구조화라 오래 걸린다(첫 호출은 폰트 캐시 빌드까지). 전역 15s로는 부족.
    return api
      .post<ExtractedSheet>("/api/extracted-sheets", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 180_000,
      })
      .then((r) => r.data);
  },
  delete: (id: string) =>
    api.delete<void>(`/api/extracted-sheets/${id}`).then(() => undefined),
};
