"use client";

import { FunctionSquare } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { GeneratorPlayground } from "@/features/question-generator/GeneratorPlayground";
import { StructuredMathExtractorPanel } from "@/features/question-generator/StructuredMathExtractorPanel";

export default function StructuredMathExtractorPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <GeneratorPlayground
        title="수학 문제 추출기 2 (정형)"
        description="문항별로 발문·보기를 LaTeX 텍스트로 전사하고 도형만 이미지로 분리합니다. 검색·편집·재조판이 가능한 정형 데이터로 저장합니다."
        icon={FunctionSquare}
        extra={<StructuredMathExtractorPanel />}
        strategies={[]}
      />
    </RequireRole>
  );
}
