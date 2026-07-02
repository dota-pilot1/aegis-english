"use client";

import { ListChecks } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { AdminPlaceholderPage } from "@/shared/ui/AdminPlaceholderPage";

export default function GrammarStandardsPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <AdminPlaceholderPage
        title="문법 기준"
        description="문법 포인트별 출제 가능 범위와 학년·과목 기준을 관리합니다."
        icon={ListChecks}
        tasks={[
          "시제, 관계사, 분사구문 등 문법 항목 조회",
          "출제 가능 학년과 과목 기준 관리",
          "대표 예문과 오답 포인트 정리",
          "문법 항목별 난이도와 태그 관리",
        ]}
      />
    </RequireRole>
  );
}
