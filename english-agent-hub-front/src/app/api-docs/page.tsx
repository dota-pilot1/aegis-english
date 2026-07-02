"use client";

import { RequireRole } from "@/widgets/guards/RequireRole";
import { SwaggerDocs } from "@/features/api-docs/SwaggerDocs";

export default function ApiDocsPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <div className="mx-auto max-w-6xl px-4 py-6">
        <h1 className="mb-1 text-xl font-bold">API 문서</h1>
        <p className="mb-4 text-sm text-gray-500">
          외부 협업용 REST API 명세입니다. 로그인 토큰이 자동 주입되어 Try it out 이 바로 동작합니다.
        </p>
        <SwaggerDocs />
      </div>
    </RequireRole>
  );
}
