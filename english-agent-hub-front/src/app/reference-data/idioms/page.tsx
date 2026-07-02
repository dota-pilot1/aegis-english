"use client";

import { Languages } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { AdminPlaceholderPage } from "@/shared/ui/AdminPlaceholderPage";

export default function IdiomDictionaryPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <AdminPlaceholderPage
        title="숙어 사전"
        description="숙어, 구동사, 관용표현을 문제 생성과 검수 기준으로 사용할 수 있게 정리합니다."
        icon={Languages}
        tasks={[
          "숙어와 구동사 목록 조회",
          "뜻, 예문, 사용 맥락 관리",
          "학년군, 난이도, 태그 분류",
          "유사 표현과 금지 표현 연결",
        ]}
      />
    </RequireRole>
  );
}
