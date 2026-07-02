"use client";

import { FileSearch } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { GeneratorPlayground } from "@/features/question-generator/GeneratorPlayground";
import { ExtractorUploadPanel } from "@/features/question-generator/ExtractorUploadPanel";

export default function QuestionExtractorPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <GeneratorPlayground
        title="문제 추출기"
        description="PDF와 이미지에서 문제를 읽어와 문제 은행에 넣을 수 있는 구조로 변환하는 흐름을 테스트합니다."
        icon={FileSearch}
        extra={<ExtractorUploadPanel />}
        strategies={[]}
      />
    </RequireRole>
  );
}
