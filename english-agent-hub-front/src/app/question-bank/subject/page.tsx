"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { QuestionBankWorkspace } from "@/features/question-bank/QuestionBankWorkspace";

function QuestionBankSubjectInner() {
  const params = useSearchParams();
  const subjectId = Number(params.get("id"));

  return <QuestionBankWorkspace subjectId={subjectId} />;
}

export default function QuestionBankSubjectPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <Suspense fallback={null}>
        <QuestionBankSubjectInner />
      </Suspense>
    </RequireRole>
  );
}
