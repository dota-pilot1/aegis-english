"use client";

import { Calculator } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { GeneratorPlayground } from "@/features/question-generator/GeneratorPlayground";
import { MathExtractorUploadPanel } from "@/features/question-generator/MathExtractorUploadPanel";

export default function MathQuestionExtractorPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <GeneratorPlayground
        title="수학 문제 추출"
        description="수학 시험지 PDF를 페이지 이미지로 렌더해, 수식·도형이 깨지지 않도록 문항을 원본 이미지로 잘라 저장합니다."
        icon={Calculator}
        extra={<MathExtractorUploadPanel />}
        strategies={[]}
      />
    </RequireRole>
  );
}
