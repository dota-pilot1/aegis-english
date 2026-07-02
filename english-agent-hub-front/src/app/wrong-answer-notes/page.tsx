"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2, NotebookPen, X, XCircle } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import {
  attemptApi,
  examApi,
  type AttemptResultItem,
  type AttemptResultResponse,
  type AttemptSummaryResponse,
} from "@/entities/exam/api/examApi";

export default function WrongAnswerNotesPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <WrongAnswerNotesWorkspace />
    </RequireRole>
  );
}

function WrongAnswerNotesWorkspace() {
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: examApi.list,
  });
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedAttempt, setSelectedAttempt] = useState<AttemptSummaryResponse | null>(null);

  const effectiveExamId = selectedExamId || exams[0]?.id || "";

  const { data: attempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ["exam-attempts", effectiveExamId],
    queryFn: () => attemptApi.ofExam(effectiveExamId),
    enabled: !!effectiveExamId,
  });

  const submittedAttempts = useMemo(
    () => attempts.filter((attempt) => attempt.status === "SUBMITTED"),
    [attempts]
  );

  const { data: result, isLoading: resultLoading } = useQuery({
    queryKey: ["attempt-result", selectedAttempt?.attemptId],
    queryFn: () => attemptApi.result(selectedAttempt!.attemptId),
    enabled: selectedAttempt !== null,
  });

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <div className="border-b border-border pb-5">
          <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
            <NotebookPen className="h-4 w-4 text-primary" />
            Wrong Answers
          </div>
          <h1 className="mt-3 text-2xl font-bold tracking-tight">오답 노트</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            응시자가 틀린 문항만 모아 제출 답안·정답·해설과 함께 복습합니다.
          </p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* 시험 목록 */}
          <aside className="min-w-0">
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-bold">시험 목록</h2>
              </div>
              {examsLoading ? (
                <LoadingRow label="불러오는 중" />
              ) : exams.length === 0 ? (
                <EmptyRow label="시험이 없습니다." />
              ) : (
                <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
                  {exams.map((exam) => (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => {
                        setSelectedExamId(exam.id);
                        setSelectedAttempt(null);
                      }}
                      className={`flex w-full flex-col gap-1.5 px-4 py-3 text-left hover:bg-accent ${
                        effectiveExamId === exam.id ? "bg-primary/5" : ""
                      }`}
                    >
                      <span className="truncate text-sm font-semibold">{exam.title}</span>
                      <ExamStatusBadge status={exam.status} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>

          {/* 응시자 목록 (제출 완료만) */}
          <section className="min-w-0">
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-bold">응시자 목록</h2>
              </div>
              {attemptsLoading ? (
                <LoadingRow label="응시 기록 불러오는 중" tall />
              ) : submittedAttempts.length === 0 ? (
                <EmptyRow label="제출된 응시 기록이 없습니다." tall />
              ) : (
                <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
                  {submittedAttempts.map((attempt) => (
                    <ExamineeRow
                      key={attempt.attemptId}
                      attempt={attempt}
                      selected={selectedAttempt?.attemptId === attempt.attemptId}
                      onSelect={() => setSelectedAttempt(attempt)}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {selectedAttempt !== null && (
        <WrongAnswerDialog
          examineeName={selectedAttempt.examineeName}
          result={result ?? null}
          loading={resultLoading}
          onClose={() => setSelectedAttempt(null)}
        />
      )}
    </main>
  );
}

function WrongAnswerDialog({
  examineeName,
  result,
  loading,
  onClose,
}: {
  examineeName: string;
  result: AttemptResultResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  const wrongItems = useMemo(
    () => (result?.items ?? []).filter((item) => item.correct === false),
    [result]
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/35 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            <NotebookPen className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="truncate text-base font-bold tracking-tight">
              {examineeName} · 오답 노트
            </h2>
            {result && (
              <span className="inline-flex shrink-0 items-center rounded-md border border-rose-200 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700">
                {wrongItems.length} / {result.items.length}문항 오답
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {loading || !result ? (
          <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            오답 불러오는 중
          </div>
        ) : wrongItems.length === 0 ? (
          <div className="flex h-48 flex-col items-center justify-center gap-2 text-sm text-muted-foreground">
            <NotebookPen className="h-6 w-6 text-emerald-500" />
            틀린 문항이 없습니다. 모두 정답입니다!
          </div>
        ) : (
          <div className="max-h-[70vh] space-y-3 overflow-y-auto p-5">
            {wrongItems.map((item) => (
              <WrongAnswerCard key={item.questionId} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WrongAnswerCard({ item }: { item: AttemptResultItem }) {
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50/30 p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-sm font-semibold">
          {item.orderNo}. {item.question}
        </p>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-rose-600">
          <XCircle className="h-4 w-4" />
          {item.earnedPoints}/{item.maxPoints}점
        </span>
      </div>

      {item.choices.length > 0 && (
        <ul className="mt-2 space-y-1">
          {item.choices.map((choice, idx) => {
            const isCorrect = choice === item.correctAnswer;
            const isSubmitted = choice === item.submittedAnswer;
            return (
              <li
                key={idx}
                className={`rounded px-2 py-1 text-xs ${
                  isCorrect
                    ? "bg-emerald-100 font-semibold text-emerald-800"
                    : isSubmitted
                      ? "bg-rose-100 font-semibold text-rose-800 line-through"
                      : "text-muted-foreground"
                }`}
              >
                {choice}
                {isCorrect && " ✓"}
                {isSubmitted && !isCorrect && " (제출)"}
              </li>
            );
          })}
        </ul>
      )}

      <div className="mt-3 grid gap-1 text-xs">
        <p>
          <span className="font-semibold text-rose-700">제출 답안:</span>{" "}
          {item.submittedAnswer || "(미응답)"}
        </p>
        <p>
          <span className="font-semibold text-emerald-700">정답:</span> {item.correctAnswer}
        </p>
      </div>

      {item.explanation && (
        <p className="mt-3 rounded-md border border-border bg-background px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">해설</span> · {item.explanation}
        </p>
      )}
    </div>
  );
}

function ExamineeRow({
  attempt,
  selected,
  onSelect,
}: {
  attempt: AttemptSummaryResponse;
  selected: boolean;
  onSelect: () => void;
}) {
  const percent = attempt.maxScore > 0 ? Math.round((attempt.totalScore / attempt.maxScore) * 100) : 0;
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-accent ${
        selected ? "bg-primary/5" : ""
      }`}
    >
      <span className="min-w-0 truncate text-sm font-semibold">{attempt.examineeName}</span>
      <span className="shrink-0 text-right">
        <span className="block text-sm font-bold">
          {attempt.totalScore}/{attempt.maxScore}점
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{percent}%</span>
      </span>
    </button>
  );
}

function ExamStatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    PUBLISHED: "border-emerald-200 bg-emerald-50 text-emerald-700",
    DRAFT: "border-border bg-muted/50 text-muted-foreground",
    CLOSED: "border-rose-200 bg-rose-50 text-rose-700",
  };
  const cls = map[status] ?? "border-border bg-muted/50 text-muted-foreground";
  return (
    <span className={`inline-flex w-fit items-center rounded border px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
      {status}
    </span>
  );
}

function LoadingRow({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <div className={`flex items-center justify-center text-sm text-muted-foreground ${tall ? "h-48" : "h-32"}`}>
      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      {label}
    </div>
  );
}

function EmptyRow({ label, tall }: { label: string; tall?: boolean }) {
  return (
    <p className={`px-4 text-center text-sm text-muted-foreground ${tall ? "py-20" : "py-12"}`}>{label}</p>
  );
}
