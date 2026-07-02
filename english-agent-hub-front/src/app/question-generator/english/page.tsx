"use client";

import { Sparkles } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { GeneratorPlayground } from "@/features/question-generator/GeneratorPlayground";
import { ExamVariantPanel } from "@/features/question-generator/ExamVariantPanel";

export default function EnglishGeneratorPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <GeneratorPlayground
        title="영어 문제 생성기"
        description="출제 명세(유형·난이도·정답 논리)를 기반으로 새 영어 문제를 생성하고 여러 방식을 비교 테스트합니다."
        icon={Sparkles}
        extra={<ExamVariantPanel />}
        strategies={[
          { name: "템플릿 기반", summary: "유형별 템플릿에 어휘·지문을 채워 빠르게 대량 생성합니다." },
          { name: "명세 추출 → 신규 생성", summary: "시드 문제에서 스펙만 추출해 원문 없이 새 지문을 생성합니다." },
          { name: "유사도 가드", summary: "생성물을 기존 문제 풀과 임베딩 대조해 과도하게 유사하면 자동 폐기합니다." },
        ]}
      />
    </RequireRole>
  );
}
