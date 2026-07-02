"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import "swagger-ui-react/swagger-ui.css";
import { tokenStorage } from "@/shared/api/tokenStorage";

// swagger-ui-react 는 window 등 브라우저 API에 의존하므로 SSR 비활성화로 동적 로드한다.
const SwaggerUI = dynamic(() => import("swagger-ui-react"), { ssr: false });

const baseURL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3301";

// 백엔드 OpenApiGroupsConfig 의 GroupedOpenApi 그룹명과 1:1 매핑.
const GROUPS = [
  { key: "all", label: "전체" },
  { key: "auth-user", label: "인증·사용자" },
  { key: "question-exam", label: "문제·시험" },
  { key: "extraction", label: "추출" },
  { key: "ai-agent", label: "AI·실시간" },
  { key: "content", label: "콘텐츠·설정" },
] as const;

/**
 * 백엔드 OpenAPI 스펙(도메인 클러스터별 /api/docs/{group})을 임베드한다.
 * - swagger-ui-react 는 기본 상단바(그룹 드롭다운)를 렌더하지 않으므로 그룹 전환 탭을 직접 둔다.
 * - 그룹 변경 시 key 로 SwaggerUI 를 리마운트해 스펙을 깔끔하게 다시 로드한다.
 * - 스펙 경로 /api/docs/{group} 는 인증이 필요(SecurityConfig)하고, 운영에서는 nginx /api/ 프록시를 탄다.
 * - requestInterceptor 가 로그인 토큰을 스펙 조회 + Try it out 요청 양쪽에 자동 주입한다.
 */
export function SwaggerDocs() {
  const [group, setGroup] = useState<string>(GROUPS[0].key);

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {GROUPS.map((g) => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
              group === g.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      <SwaggerUI
        key={group}
        url={`${baseURL}/api/docs/${group}`}
        docExpansion="none"
        filter
        persistAuthorization
        requestInterceptor={(req) => {
          const token = tokenStorage.getAccess();
          if (token) {
            req.headers = { ...req.headers, Authorization: `Bearer ${token}` };
          }
          return req;
        }}
      />
    </div>
  );
}
