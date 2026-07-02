import { api } from "@/shared/api/axios";

export type ExtractedMathItem = {
  questionNumber: number | null;
  /** 발문·도형·보기가 한 장에 담긴 문항 이미지 URL */
  imageUrl: string;
  /** 배점 (2/3/4) */
  points: number | null;
  /** 5지선다 | 단답형 */
  type: string | null;
  /** 정답 PDF에서 매핑한 정답 (①~⑤ 또는 정수 문자열) */
  answer: string | null;
  /** 공통 | 확률과통계 | 미적분 | 기하 */
  subject: string | null;
  /** PDF 텍스트 레이어에서 살린 발문/보기 텍스트(검색·검수용, 수식은 깨질 수 있음) */
  text: string | null;
  /** 도형·그래프 포함 추정 */
  hasFigure: boolean;
  /** 수식/도형/보기누락 등으로 사람 검수가 필요한 문항 */
  needsReview: boolean;
};

export type ExtractedMathSheet = {
  id: string;
  title: string;
  sourceFileName: string | null;
  itemCount: number;
  createdByName: string;
  createdAt: string;
  /** 목록(카드)에서는 빈 배열, 상세에서는 채워짐 */
  items: ExtractedMathItem[];
};

export const extractedMathSheetApi = {
  list: () =>
    api.get<ExtractedMathSheet[]>("/api/extracted-math-sheets").then((r) => r.data),
  get: (id: string) =>
    api.get<ExtractedMathSheet>(`/api/extracted-math-sheets/${id}`).then((r) => r.data),
  /** problem: 문제 PDF, answer: 정답 PDF(선택) */
  create: (problem: File, answer?: File | null) => {
    const form = new FormData();
    form.append("file", problem);
    if (answer) form.append("answerFile", answer);
    // 페이지 렌더 + Vision 감지 + 크롭/업로드라 오래 걸린다. 전역 타임아웃으로는 부족.
    return api
      .post<ExtractedMathSheet>("/api/extracted-math-sheets", form, {
        headers: { "Content-Type": "multipart/form-data" },
        timeout: 300_000,
      })
      .then((r) => r.data);
  },
  delete: (id: string) =>
    api.delete<void>(`/api/extracted-math-sheets/${id}`).then(() => undefined),
};
