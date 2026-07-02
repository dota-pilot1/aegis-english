"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCircle2, Clock3, Loader2, Trophy, XCircle } from "lucide-react";
import { RequireAuth } from "@/widgets/guards/RequireAuth";
import {
  attemptApi,
  type AttemptResultResponse,
  type AttemptSummaryResponse,
} from "@/entities/exam/api/examApi";

export default function ScoresPage() {
  return (
    <RequireAuth>
      <ScoresWorkspace />
    </RequireAuth>
  );
}

function ScoresWorkspace() {
  const router = useRouter();
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);

  const { data: attempts = [], isLoading } = useQuery({
    queryKey: ["my-attempts"],
    queryFn: attemptApi.myAttempts,
  });

  const { data: result, isLoading: resultLoading } = useQuery({
    queryKey: ["attempt-result", selectedAttemptId],
    queryFn: () => attemptApi.result(selectedAttemptId!),
    enabled: selectedAttemptId !== null,
  });

  const stats = useMemo(() => {
    const submitted = attempts.filter((attempt) => attempt.status === "SUBMITTED");
    const average =
      submitted.length === 0
        ? null
        : Math.round(
            submitted.reduce((sum, attempt) => {
              if (attempt.maxScore <= 0) return sum;
              return sum + (attempt.totalScore / attempt.maxScore) * 100;
            }, 0) / submitted.length
          );

    return { submitted: submitted.length, total: attempts.length, average };
  }, [attempts]);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto grid w-full max-w-[1180px] gap-5 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section className="min-w-0 space-y-5">
          <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
                <Trophy className="h-4 w-4 text-primary" />
                Scores
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">성적/기록</h1>
              <p className="mt-1 text-sm text-muted-foreground">내 풀이 기록과 채점 결과를 확인합니다.</p>
            </div>

            <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
              <StatBox label="전체" value={`${stats.total}`} />
              <StatBox label="완료" value={`${stats.submitted}`} />
              <StatBox label="평균" value={stats.average === null ? "-" : `${stats.average}%`} />
            </div>
          </div>

          {isLoading ? (
            <CenterState text="성적 기록을 불러오는 중" />
          ) : attempts.length === 0 ? (
            <EmptyState />
          ) : (
            <div className="grid gap-3">
              {attempts.map((attempt) => (
                <AttemptCard
                  key={attempt.attemptId}
                  attempt={attempt}
                  selected={selectedAttemptId === attempt.attemptId}
                  onResult={() => setSelectedAttemptId(attempt.attemptId)}
                  onContinue={() => router.push(`/exams/take?id=${attempt.examId}`)}
                />
              ))}
            </div>
          )}
        </section>

        <aside className="min-w-0">
          <ResultPanel result={result ?? null} loading={resultLoading} />
        </aside>
      </div>
    </main>
  );
}

function AttemptCard({
  attempt,
  selected,
  onResult,
  onContinue,
}: {
  attempt: AttemptSummaryResponse;
  selected: boolean;
  onResult: () => void;
  onContinue: () => void;
}) {
  const submitted = attempt.status === "SUBMITTED";
  const percent = attempt.maxScore > 0 ? Math.round((attempt.totalScore / attempt.maxScore) * 100) : 0;

  return (
    <article className={`rounded-lg border bg-background p-4 ${selected ? "border-primary" : "border-border"}`}>
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-bold">{attempt.examTitle}</h2>
            <span
              className={`rounded-md border px-2 py-0.5 text-xs font-semibold ${
                submitted
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-amber-200 bg-amber-50 text-amber-700"
              }`}
            >
              {submitted ? "제출 완료" : "진행 중"}
            </span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            {submitted ? formatDate(attempt.submittedAt) : formatDate(attempt.startedAt)}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {submitted && (
            <span className="text-sm font-bold tabular-nums">
              {attempt.totalScore}/{attempt.maxScore}점 · {percent}%
            </span>
          )}
          <button
            type="button"
            onClick={submitted ? onResult : onContinue}
            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90"
          >
            {submitted ? "결과 보기" : "이어 풀기"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
}

function ResultPanel({ result, loading }: { result: AttemptResultResponse | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="rounded-lg border border-border bg-background p-5">
        <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          결과 불러오는 중
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-border bg-background p-5">
        <p className="text-sm font-bold">결과 상세</p>
        <p className="mt-3 rounded-md border border-dashed border-border px-3 py-8 text-center text-sm text-muted-foreground">
          왼쪽 목록에서 제출 완료된 기록을 선택하세요.
        </p>
      </div>
    );
  }

  const percent = result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;

  return (
    <div className="rounded-lg border border-border bg-background p-5">
      <p className="text-sm font-bold">{result.examTitle}</p>
      <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4 text-center">
        <p className="text-3xl font-extrabold tabular-nums">
          {result.totalScore}
          <span className="text-base font-bold text-muted-foreground"> / {result.maxScore}점</span>
        </p>
        <p className="mt-1 text-sm text-muted-foreground">정답률 {percent}%</p>
      </div>

      <div className="mt-4 max-h-[58vh] space-y-2 overflow-y-auto pr-1">
        {result.items.map((item, index) => (
          <div key={item.questionId} className="rounded-md border border-border p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 text-sm font-semibold">
                {index + 1}. {item.question}
              </p>
              <span className={item.correct ? "text-emerald-600" : "text-rose-600"}>
                {item.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              </span>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              내 답안: {item.submittedAnswer || "(미응답)"}
            </p>
            {!item.correct && <p className="mt-1 text-xs text-emerald-700">정답: {item.correctAnswer}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2">
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

function CenterState({ text }: { text: string }) {
  return (
    <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {text}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-background text-center">
      <Clock3 className="h-8 w-8 text-muted-foreground" />
      <p className="mt-3 text-sm font-semibold">아직 성적 기록이 없습니다.</p>
      <p className="mt-1 text-xs text-muted-foreground">문제를 풀고 제출하면 이곳에 기록됩니다.</p>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
