"use client";

import { Calculator } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { GeneratorPlayground } from "@/features/question-generator/GeneratorPlayground";

export default function MathGeneratorPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <GeneratorPlayground
        title="수학 문제 생성기"
        description="출제 명세(단원·난이도·풀이 구조)를 기반으로 새 수학 문제를 생성하고 여러 방식을 비교 테스트합니다."
        icon={Calculator}
        strategies={[
          { name: "파라미터화 템플릿", summary: "수식의 계수·변수를 무작위로 바꿔 동형 문제를 대량 생성합니다." },
          { name: "명세 추출 → 신규 생성", summary: "시드 문제에서 풀이 구조만 추출해 새 수치·맥락으로 재구성합니다." },
          { name: "유사도 가드", summary: "생성물을 기존 문제 풀과 임베딩 대조해 과도하게 유사하면 자동 폐기합니다." },
        ]}
      />
    </RequireRole>
  );
}
