"use client";

import Link from "next/link";
import { RequireRole } from "@/widgets/guards/RequireRole";

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "https://dxline-tallent.com";

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

const methodColor: Record<Method, string> = {
  GET: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  POST: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  PUT: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

type Endpoint = { method: Method; path: string; desc: string; auth: "public" | "admin" | "user" };

const authBadge: Record<Endpoint["auth"], { label: string; cls: string }> = {
  public: { label: "공개", cls: "bg-muted text-muted-foreground" },
  user: { label: "로그인", cls: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300" },
  admin: { label: "ADMIN", cls: "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300" },
};

function EndpointRow({ e }: { e: Endpoint }) {
  return (
    <div className="flex items-center gap-3 border-t border-border px-3 py-2.5 text-sm first:border-t-0">
      <span className={`w-16 shrink-0 rounded px-2 py-0.5 text-center text-xs font-bold ${methodColor[e.method]}`}>
        {e.method}
      </span>
      <code className="min-w-0 flex-1 truncate font-mono text-[13px] text-foreground">{e.path}</code>
      <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{e.desc}</span>
      <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${authBadge[e.auth].cls}`}>
        {authBadge[e.auth].label}
      </span>
    </div>
  );
}

function Section({ title, hint, endpoints }: { title: string; hint?: string; endpoints: Endpoint[] }) {
  return (
    <section className="mb-6">
      <div className="mb-2">
        <h2 className="text-sm font-bold text-foreground">{title}</h2>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        {endpoints.map((e) => (
          <EndpointRow key={e.method + e.path} e={e} />
        ))}
      </div>
    </section>
  );
}

const AUTH: Endpoint[] = [
  { method: "POST", path: "/api/auth/login", desc: "이메일·비밀번호 → accessToken/refreshToken", auth: "public" },
  { method: "POST", path: "/api/auth/refresh", desc: "refreshToken → 새 accessToken", auth: "public" },
  { method: "GET", path: "/api/auth/me", desc: "내 계정·역할 정보", auth: "user" },
];

const QUESTIONS: Endpoint[] = [
  { method: "GET", path: "/api/questions?page=0&size=50&sort=createdAt,desc", desc: "문제 목록 조회(페이지)", auth: "admin" },
  { method: "GET", path: "/api/questions/{id}", desc: "문제 단건 조회", auth: "admin" },
  { method: "POST", path: "/api/questions", desc: "문제 등록", auth: "admin" },
  { method: "PUT", path: "/api/questions/{id}", desc: "문제 수정", auth: "admin" },
  { method: "DELETE", path: "/api/questions/{id}", desc: "문제 삭제", auth: "admin" },
  { method: "GET", path: "/api/questions/{id}/similar", desc: "유사 문제 조회", auth: "admin" },
  { method: "POST", path: "/api/questions/{id}/generate-similar-reading", desc: "소스 문제 기반 유사 독해 생성", auth: "admin" },
  { method: "GET", path: "/api/questions/embedding-status", desc: "임베딩 상태 카운트", auth: "admin" },
];

const MATH: Endpoint[] = [
  { method: "POST", path: "/api/structured-math-sheets", desc: "PDF 업로드 → 추출 잡 시작 (202 + jobId)", auth: "admin" },
  { method: "GET", path: "/api/structured-math-sheets/jobs/{jobId}", desc: "잡 진행 상태 폴링", auth: "admin" },
  { method: "GET", path: "/api/structured-math-sheets", desc: "시험지 목록(카드)", auth: "admin" },
  { method: "GET", path: "/api/structured-math-sheets/{id}", desc: "시험지 단건(문항 포함)", auth: "admin" },
  { method: "DELETE", path: "/api/structured-math-sheets/{id}", desc: "시험지 삭제", auth: "admin" },
];

const PUBLIC: Endpoint[] = [
  { method: "GET", path: "/api/agents", desc: "공유 캐릭터(에이전트) 목록", auth: "public" },
  { method: "GET", path: "/api/site-settings", desc: "사이트 설정", auth: "public" },
  { method: "GET", path: "/api/menus", desc: "헤더 메뉴 트리", auth: "public" },
];

export default function KeyApiPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <div className="mx-auto max-w-4xl px-4 py-6">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">주요 API</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              외부 협업에 자주 쓰는 핵심 엔드포인트와 인증 흐름입니다. 전체 명세·Try it out 은{" "}
              <Link href="/api-docs" className="font-medium text-primary underline underline-offset-2">
                Swagger
              </Link>{" "}
              탭을 이용하세요.
            </p>
          </div>
          <Link
            href="/api-docs"
            className="shrink-0 rounded-md border border-border bg-background px-3 py-1.5 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Swagger 열기 →
          </Link>
        </div>

        {/* 인증 흐름 */}
        <section className="mb-6 rounded-lg border border-border bg-muted/40 p-4">
          <h2 className="mb-2 text-sm font-bold text-foreground">인증 흐름</h2>
          <ol className="mb-3 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            <li>
              <code className="font-mono text-[13px] text-foreground">POST /api/auth/login</code> 으로 토큰을 받습니다.
            </li>
            <li>
              이후 모든 요청 헤더에{" "}
              <code className="font-mono text-[13px] text-foreground">Authorization: Bearer &lt;accessToken&gt;</code>{" "}
              를 붙입니다. (accessToken 30분 만료 → <code className="font-mono text-[13px] text-foreground">/api/auth/refresh</code> 로 갱신)
            </li>
            <li>Swagger 탭은 로그인 토큰이 자동 주입되어 Try it out 이 바로 동작합니다.</li>
          </ol>
          <pre className="overflow-x-auto rounded-md border border-border bg-background p-3 text-[12px] leading-5 text-foreground">
            <code>{`curl -X POST ${BASE}/api/auth/login \\
  -H "Content-Type: application/json" \\
  -d '{"email":"you@example.com","password":"••••••••"}'

# → { "accessToken": "eyJ...", "refreshToken": "eyJ...",
#     "accessTokenExpiresInSec": 1800, "user": { ... } }`}</code>
          </pre>
        </section>

        <Section title="인증 (Auth)" endpoints={AUTH} />
        <Section
          title="문제 은행 (Question Bank)"
          hint="외부 제공 시 가장 많이 쓰는 문제 생성/조회 API입니다. 목록 응답은 Page 구조(content, totalElements, totalPages 등)입니다."
          endpoints={QUESTIONS}
        />
        <Section
          title="수학 정형 추출 (Structured Math)"
          hint="비동기 Request-Reply: 잡 시작(202) → 상태 폴링 → 완료 시 sheetId 로 단건 조회"
          endpoints={MATH}
        />
        <Section title="공개 (무인증 GET)" endpoints={PUBLIC} />

        <p className="mt-2 text-xs text-muted-foreground">
          ※ ADMIN 표시 엔드포인트는 관리자 역할이 있어야 호출됩니다. 이 목록은 핵심만 추린 요약이며, 전체 엔드포인트는 Swagger를 참고하세요.
        </p>
      </div>
    </RequireRole>
  );
}
