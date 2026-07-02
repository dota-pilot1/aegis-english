"use client";

import { GraduationCap } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { AdminPlaceholderPage } from "@/shared/ui/AdminPlaceholderPage";

export default function CurriculumPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <AdminPlaceholderPage
        title="교육과정"
        description="교육과정 버전, 과목, 성취기준을 기준정보의 최상위 기준으로 관리합니다."
        icon={GraduationCap}
        tasks={[
          "교육과정 버전별 기준 조회",
          "고등 공통영어, 영어 I, 영어 II 과목 관리",
          "성취기준 코드와 설명 관리",
          "어휘·숙어·문법 기준정보와 연결",
        ]}
      />
    </RequireRole>
  );
}
