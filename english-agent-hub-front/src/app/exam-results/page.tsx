"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, CheckCircle2, Loader2, Trash2, Trophy, X, XCircle } from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import {
  attemptApi,
  examApi,
  type AttemptResultResponse,
  type AttemptSummaryResponse,
} from "@/entities/exam/api/examApi";
import { toast, toastError } from "@/shared/lib/toast";

export default function ExamResultsPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <ExamResultsWorkspace />
    </RequireRole>
  );
}

function ExamResultsWorkspace() {
  const qc = useQueryClient();
  const { data: exams = [], isLoading: examsLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: examApi.list,
  });
  const [selectedExamId, setSelectedExamId] = useState<string>("");
  const [selectedAttemptId, setSelectedAttemptId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AttemptSummaryResponse | null>(null);

  const effectiveExamId = selectedExamId || exams[0]?.id || "";

  const { data: attempts = [], isLoading: attemptsLoading } = useQuery({
    queryKey: ["exam-attempts", effectiveExamId],
    queryFn: () => attemptApi.ofExam(effectiveExamId),
    enabled: !!effectiveExamId,
  });

  const { data: result, isLoading: resultLoading } = useQuery({
    queryKey: ["attempt-result", selectedAttemptId],
    queryFn: () => attemptApi.result(selectedAttemptId!),
    enabled: selectedAttemptId !== null,
  });

  const deleteMutation = useMutation({
    mutationFn: (attemptId: string) => attemptApi.delete(attemptId),
    onSuccess: (_data, attemptId) => {
      toast.success("응시 기록을 삭제했습니다.");
      if (selectedAttemptId === attemptId) setSelectedAttemptId(null);
      setPendingDelete(null);
      qc.invalidateQueries({ queryKey: ["exam-attempts", effectiveExamId] });
    },
    onError: (e) => toastError(e, "삭제에 실패했습니다."),
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
    return { total: attempts.length, submitted: submitted.length, average };
  }, [attempts]);

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <div className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
              <BarChart3 className="h-4 w-4 text-primary" />
              Results
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">성적 관리</h1>
            <p className="mt-1 text-sm text-muted-foreground">시험별 응시자 성적과 채점 결과를 확인합니다.</p>
          </div>

          <div className="grid grid-cols-3 gap-2 md:min-w-[360px]">
            <StatBox label="응시" value={`${stats.total}`} />
            <StatBox label="제출" value={`${stats.submitted}`} />
            <StatBox label="평균" value={stats.average === null ? "-" : `${stats.average}%`} />
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* 시험 목록 사이드바 */}
          <aside className="min-w-0">
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-bold">시험 목록</h2>
              </div>
              {examsLoading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  불러오는 중
                </div>
              ) : exams.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">시험이 없습니다.</p>
              ) : (
                <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
                  {exams.map((exam) => (
                    <button
                      key={exam.id}
                      type="button"
                      onClick={() => {
                        setSelectedExamId(exam.id);
                        setSelectedAttemptId(null);
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

          {/* 응시자 목록 */}
          <section className="min-w-0">
            <div className="rounded-lg border border-border bg-background">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-base font-bold">응시자 목록</h2>
              </div>

              {attemptsLoading ? (
                <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  응시 기록 불러오는 중
                </div>
              ) : attempts.length === 0 ? (
                <p className="px-4 py-12 text-center text-sm text-muted-foreground">아직 응시 기록이 없습니다.</p>
              ) : (
                <div className="max-h-[72vh] divide-y divide-border overflow-y-auto">
                  {attempts.map((attempt) => (
                    <AttemptRow
                      key={attempt.attemptId}
                      attempt={attempt}
                      selected={selectedAttemptId === attempt.attemptId}
                      onSelect={() => setSelectedAttemptId(attempt.attemptId)}
                      onDelete={() => setPendingDelete(attempt)}
                      deleting={deleteMutation.isPending && deleteMutation.variables === attempt.attemptId}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

        </div>
      </div>

      {selectedAttemptId !== null && (
        <ResultDialog
          result={result ?? null}
          loading={resultLoading}
          onClose={() => setSelectedAttemptId(null)}
        />
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        variant="destructive"
        title="응시 기록 삭제"
        description={
          pendingDelete
            ? `'${pendingDelete.examineeName}'님의 응시 기록을 삭제할까요?\n삭제하면 되돌릴 수 없습니다.`
            : undefined
        }
        confirmText="삭제"
        loading={deleteMutation.isPending}
        onConfirm={() => pendingDelete && deleteMutation.mutate(pendingDelete.attemptId)}
        onCancel={() => setPendingDelete(null)}
      />
    </main>
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

function AttemptRow({
  attempt,
  selected,
  onSelect,
  onDelete,
  deleting,
}: {
  attempt: AttemptSummaryResponse;
  selected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  const submitted = attempt.status === "SUBMITTED";
  const percent = attempt.maxScore > 0 ? Math.round((attempt.totalScore / attempt.maxScore) * 100) : 0;

  return (
    <div className={`flex items-center gap-2 pr-2 hover:bg-accent ${selected ? "bg-primary/5" : ""}`}>
      <button
        type="button"
        onClick={submitted ? onSelect : undefined}
        disabled={!submitted}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left disabled:cursor-not-allowed disabled:opacity-70"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold">{attempt.examineeName}</p>
          <p className="mt-1 truncate text-xs text-muted-foreground">{attempt.examTitle}</p>
        </div>
        <div className="shrink-0 text-right">
          <p className={`text-sm font-bold ${submitted ? "text-foreground" : "text-amber-600"}`}>
            {submitted ? `${attempt.totalScore}/${attempt.maxScore}점` : "진행 중"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{submitted ? `${percent}%` : formatDate(attempt.startedAt)}</p>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        aria-label="응시 기록 삭제"
        title="응시 기록 삭제"
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
      >
        {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
      </button>
    </div>
  );
}

function ResultDialog({
  result,
  loading,
  onClose,
}: {
  result: AttemptResultResponse | null;
  loading: boolean;
  onClose: () => void;
}) {
  const percent =
    result && result.maxScore > 0 ? Math.round((result.totalScore / result.maxScore) * 100) : 0;

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
            <Trophy className="h-4 w-4 shrink-0 text-primary" />
            <h2 className="truncate text-base font-bold tracking-tight">
              {result?.examTitle ?? "채점 결과"}
            </h2>
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
            결과 불러오는 중
          </div>
        ) : (
          <div className="p-5">
            <div className="rounded-lg border border-border bg-muted/30 p-4 text-center">
              <p className="text-3xl font-extrabold tabular-nums">
                {result.totalScore}
                <span className="text-base font-bold text-muted-foreground"> / {result.maxScore}점</span>
              </p>
              <p className="mt-1 text-sm text-muted-foreground">정답률 {percent}%</p>
            </div>

            <div className="mt-4 grid max-h-[60vh] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">
              {result.items.map((item, index) => (
                <div
                  key={item.questionId}
                  className={`break-inside-avoid rounded-md border p-3 ${
                    item.correct ? "border-emerald-200 bg-emerald-50/40" : "border-rose-200 bg-rose-50/40"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 text-sm font-semibold">
                      {index + 1}. {item.question}
                    </p>
                    <span className={item.correct ? "text-emerald-600" : "text-rose-600"}>
                      {item.correct ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    </span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">답안: {item.submittedAnswer || "(미응답)"}</p>
                  {!item.correct && <p className="mt-1 text-xs text-emerald-700">정답: {item.correctAnswer}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
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

function formatDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}
