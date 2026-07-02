"use client";

import { ClipboardList } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { AdminPlaceholderPage } from "@/shared/ui/AdminPlaceholderPage";

export default function QuestionTypesPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <AdminPlaceholderPage
        title="문항 유형"
        description="독해, 어법, 어휘 등 문제 유형별 구조와 검수 기준을 관리합니다."
        icon={ClipboardList}
        tasks={[
          "빈칸, 순서, 삽입, 요지, 제목 유형 조회",
          "유형별 필수 구성요소 관리",
          "선택지 수, 정답 수, 해설 기준 관리",
          "AI 생성 프롬프트와 검수 규칙 연결",
        ]}
      />
    </RequireRole>
  );
}
