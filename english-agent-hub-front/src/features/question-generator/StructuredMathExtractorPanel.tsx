"use client";

import { ChangeEvent, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, FileText, FunctionSquare, Loader2, ScrollText, Trash2, Upload, X } from "lucide-react";
import {
  structuredMathSheetApi,
  type StructuredMathSheet,
} from "@/entities/structured-math-sheet/api/structuredMathSheetApi";
import { MathText } from "@/shared/ui/MathText";
import { toast, toastError } from "@/shared/lib/toast";

const CHOICE_MARKS = ["①", "②", "③", "④", "⑤"];
type PreviewMode = "exam" | "quiz";
type StructuredMathHash = { sheetId: string; mode: PreviewMode; questionIndex: number };

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export function StructuredMathExtractorPanel() {
  const qc = useQueryClient();
  const [problem, setProblem] = useState<File | null>(null);
  const [answer, setAnswer] = useState<File | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [initialPreviewMode, setInitialPreviewMode] = useState<PreviewMode>("exam");
  const [initialQuestionIndex, setInitialQuestionIndex] = useState(0);

  const { data: sheets = [] } = useQuery({
    queryKey: ["structured-math-sheets"],
    queryFn: structuredMathSheetApi.list,
  });

  const { data: openSheet, isLoading: openLoading } = useQuery({
    queryKey: ["structured-math-sheets", openId],
    queryFn: () => structuredMathSheetApi.get(openId as string),
    enabled: openId != null,
  });

  const openSheetDetail = (sheetId: string, mode: PreviewMode = "exam", questionIndex = 0) => {
    setOpenId(sheetId);
    setInitialPreviewMode(mode);
    setInitialQuestionIndex(questionIndex);
    replaceStructuredMathHash(sheetId, mode, questionIndex);
  };
  const closeSheetDetail = () => {
    setOpenId(null);
    clearStructuredMathHash();
  };

  // 비동기 잡(Async Request-Reply): POST는 즉시 jobId를 받고, 상태를 폴링한다.
  const [jobId, setJobId] = useState<string | null>(null);

  const startMutation = useMutation({
    mutationFn: () => structuredMathSheetApi.startJob(problem as File, answer),
    onSuccess: (id) => setJobId(id),
    onError: (e) => toastError(e, "정형 추출 시작에 실패했습니다."),
  });

  const { data: job } = useQuery({
    queryKey: ["structured-job", jobId],
    queryFn: () => structuredMathSheetApi.getJob(jobId as string),
    enabled: jobId != null,
    refetchInterval: (query) => {
      const s = query.state.data?.status;
      return s === "DONE" || s === "FAILED" ? false : 2500;
    },
  });

  useEffect(() => {
    if (!job) return;
    if (job.status === "DONE" && job.sheetId) {
      toast.success("정형 추출 완료");
      qc.invalidateQueries({ queryKey: ["structured-math-sheets"] });
      openSheetDetail(job.sheetId, "exam", 0);
      setJobId(null);
    } else if (job.status === "FAILED") {
      toast.error(job.error || "정형 추출에 실패했습니다.");
      setJobId(null);
    }
  }, [job, qc]);

  useEffect(() => {
    const applyHash = () => {
      const parsed = parseStructuredMathHash();
      if (!parsed) return;
      setOpenId(parsed.sheetId);
      setInitialPreviewMode(parsed.mode);
      setInitialQuestionIndex(parsed.questionIndex);
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, []);

  const running = startMutation.isPending || (jobId != null && job?.status !== "DONE" && job?.status !== "FAILED");

  const deleteMutation = useMutation({
    mutationFn: (id: string) => structuredMathSheetApi.delete(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["structured-math-sheets"] });
      if (openId === id) {
        setOpenId(null);
        clearStructuredMathHash();
      }
    },
    onError: (e) => toastError(e, "삭제에 실패했습니다."),
  });

  const pickProblem = (e: ChangeEvent<HTMLInputElement>) => setProblem(e.target.files?.[0] ?? null);
  const pickAnswer = (e: ChangeEvent<HTMLInputElement>) => setAnswer(e.target.files?.[0] ?? null);
  const problemIsPdf = problem?.type === "application/pdf";

  return (
    <section className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-lg border border-border bg-background p-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
              <FunctionSquare className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">수학 시험지 업로드 (정형)</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                발문·보기를 LaTeX 텍스트로 전사하고, 도형만 이미지로 분리합니다.
              </p>
            </div>
          </div>

          <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-accent">
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="mt-2 text-sm font-semibold">문제 PDF 선택 (필수)</span>
            <span className="mt-1 text-xs text-muted-foreground">문항별로 Vision 전사 → 검색·편집 가능한 텍스트</span>
            <input type="file" accept="application/pdf" onChange={pickProblem} className="sr-only" />
          </label>

          <label className="mt-3 flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4 text-center transition-colors hover:border-primary hover:bg-accent">
            <span className="text-sm font-semibold">정답 PDF 선택 (선택)</span>
            <span className="mt-1 text-xs text-muted-foreground">정답표를 읽어 문항별 정답·배점 자동 매핑</span>
            <input type="file" accept="application/pdf" onChange={pickAnswer} className="sr-only" />
          </label>

          <div className="mt-4 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
            정형 추출은 문항마다 AI 전사를 돌려 <b>이미지 추출기보다 느립니다</b>. 수식은 가끔 오류가 있을 수 있어 검수가 필요해요.
          </div>
        </div>

        <aside className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-base font-bold">선택 파일</h2>
          <div className="mt-4 space-y-2">
            <FileRow label="문제 PDF" file={problem} onClear={() => setProblem(null)} />
            <FileRow label="정답 PDF" file={answer} onClear={() => setAnswer(null)} optional />
          </div>
          <button
            type="button"
            disabled={!problemIsPdf || running}
            onClick={() => startMutation.mutate()}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <FunctionSquare className="h-4 w-4" />}
            정형 추출 (LaTeX)
          </button>
          {problem && !problemIsPdf && <p className="mt-2 text-xs text-destructive">문제 파일은 PDF만 지원합니다.</p>}
        </aside>
      </div>

      {running && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          문항별로 수식을 LaTeX로 전사하는 중입니다…
          {job && job.total > 0 && (
            <span className="font-semibold text-foreground">
              {job.done}/{job.total}
            </span>
          )}
        </div>
      )}

      {sheets.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-base font-bold">
            정형 시험지 <span className="text-sm font-medium text-muted-foreground">{sheets.length}개</span>
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((sheet) => (
              <SheetCard
                key={sheet.id}
                sheet={sheet}
                onOpen={() => openSheetDetail(sheet.id)}
                onDelete={() => deleteMutation.mutate(sheet.id)}
                deleting={deleteMutation.isPending && deleteMutation.variables === sheet.id}
              />
            ))}
          </div>
        </div>
      )}

      {openId && (
        <DetailModal
          sheet={openSheet ?? null}
          loading={openLoading}
          initialMode={initialPreviewMode}
          initialQuestionIndex={initialQuestionIndex}
          onClose={closeSheetDetail}
        />
      )}
    </section>
  );
}

function FileRow({
  label,
  file,
  onClear,
  optional,
}: {
  label: string;
  file: File | null;
  onClear: () => void;
  optional?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-muted/25 p-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground">
        <FileText className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-semibold text-muted-foreground">
          {label}
          {optional && <span className="ml-1 font-normal">(선택)</span>}
        </div>
        {file ? (
          <div className="truncate text-sm font-medium" title={file.name}>
            {file.name} <span className="text-xs text-muted-foreground">· {formatBytes(file.size)}</span>
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">선택 안 됨</div>
        )}
      </div>
      {file && (
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
          aria-label={`${label} 지우기`}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function SheetCard({
  sheet,
  onOpen,
  onDelete,
  deleting,
}: {
  sheet: StructuredMathSheet;
  onOpen: () => void;
  onDelete: () => void;
  deleting: boolean;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen();
        }
      }}
      className="group cursor-pointer rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
          <FunctionSquare className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={deleting}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground opacity-0 transition-opacity hover:bg-destructive hover:text-white group-hover:opacity-100 disabled:opacity-50"
          aria-label="삭제"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <h3 className="mt-3 truncate text-sm font-bold" title={sheet.title}>
        {sheet.title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{sheet.itemCount}문항 · 정형(LaTeX)</p>
      <p className="mt-3 text-xs text-muted-foreground">{new Date(sheet.createdAt).toLocaleString()}</p>
    </div>
  );
}

function DetailModal({
  sheet,
  loading,
  initialMode,
  initialQuestionIndex,
  onClose,
}: {
  sheet: StructuredMathSheet | null;
  loading: boolean;
  initialMode: PreviewMode;
  initialQuestionIndex: number;
  onClose: () => void;
}) {
  const [previewMode, setPreviewMode] = useState<PreviewMode>(initialMode);
  const [quizIndex, setQuizIndex] = useState(initialQuestionIndex);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, string>>({});

  useEffect(() => {
    setPreviewMode(initialMode);
    setQuizIndex(clampQuestionIndex(initialQuestionIndex, sheet?.items.length ?? 1));
  }, [initialMode, initialQuestionIndex, sheet?.id, sheet?.items.length]);

  const changePreviewMode = (mode: PreviewMode) => {
    setPreviewMode(mode);
    if (sheet) replaceStructuredMathHash(sheet.id, mode, quizIndex);
  };
  const changeQuizIndex = (nextIndex: number) => {
    const clamped = clampQuestionIndex(nextIndex, sheet?.items.length ?? 1);
    setQuizIndex(clamped);
    if (sheet) replaceStructuredMathHash(sheet.id, "quiz", clamped);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-3 py-6 xl:px-5"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[1440px] overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{sheet?.title ?? "불러오는 중"}</h2>
            {sheet && (
              <p className="mt-0.5 text-xs text-muted-foreground">{sheet.itemCount}문항 · 발문·보기=LaTeX, 도형=이미지</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <div className="inline-flex h-8 overflow-hidden rounded-md border border-border bg-background">
              <button
                type="button"
                onClick={() => changePreviewMode("exam")}
                title="시험지형"
                aria-pressed={previewMode === "exam"}
                className={`inline-flex items-center gap-1.5 px-3 text-xs font-semibold ${
                  previewMode === "exam" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <ScrollText className="h-3.5 w-3.5" />
                시험지형
              </button>
              <button
                type="button"
                onClick={() => changePreviewMode("quiz")}
                title="퀴즈형"
                aria-pressed={previewMode === "quiz"}
                className={`inline-flex items-center gap-1.5 border-l border-border px-3 text-xs font-semibold ${
                  previewMode === "quiz" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-accent"
                }`}
              >
                <FunctionSquare className="h-3.5 w-3.5" />
                퀴즈형
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
              aria-label="닫기"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[84vh] overflow-y-auto p-5 xl:p-6">
          {loading || !sheet ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              불러오는 중
            </div>
          ) : (
            previewMode === "exam" ? (
              <StructuredMathExamPreview sheet={sheet} />
            ) : (
              <StructuredMathQuizPreview
                sheet={sheet}
                quizIndex={quizIndex}
                selectedAnswers={selectedAnswers}
                onSelectAnswer={(questionIndex, answer) =>
                  setSelectedAnswers((current) => ({ ...current, [questionIndex]: answer }))
                }
                onChangeQuizIndex={changeQuizIndex}
              />
            )
          )}
        </div>
      </div>
    </div>
  );
}

function StructuredMathExamPreview({ sheet }: { sheet: StructuredMathSheet }) {
  return (
    <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sheet.items.map((item, i) => (
        <li key={i} className="rounded-md border border-border bg-muted/20 p-4">
          <StructuredMathMeta item={item} index={i} />
          <div className="mt-3 text-sm leading-7">
            <MathText text={item.prompt} />
          </div>
          <StructuredMathFigure item={item} index={i} />
          <StructuredMathChoices item={item} variant="exam" />
        </li>
      ))}
    </ol>
  );
}

function StructuredMathQuizPreview({
  sheet,
  quizIndex,
  selectedAnswers,
  onSelectAnswer,
  onChangeQuizIndex,
}: {
  sheet: StructuredMathSheet;
  quizIndex: number;
  selectedAnswers: Record<number, string>;
  onSelectAnswer: (questionIndex: number, answer: string) => void;
  onChangeQuizIndex: (index: number) => void;
}) {
  const currentIndex = clampQuestionIndex(quizIndex, sheet.items.length);
  const item = sheet.items[currentIndex];
  const solvedCount = currentIndex + 1;
  const answeredCount = sheet.items.filter((_item, index) => selectedAnswers[index]).length;
  const pendingCount = Math.max(sheet.items.length - answeredCount, 0);
  const activeNumberRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    activeNumberRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentIndex]);

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-h-[700px] rounded-md border border-border bg-white p-6 text-foreground">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">{sheet.title}</p>
            <h3 className="mt-1 text-base font-bold">
              {item.questionNumber ?? currentIndex + 1}. {item.points != null && `[${item.points}점] `}
              <span className="text-muted-foreground">문항</span>
            </h3>
          </div>
          <div className="rounded-md bg-foreground px-4 py-2 text-sm font-bold text-background">
            {solvedCount} / {sheet.items.length}
          </div>
        </div>

        <div className="grid min-h-[540px] gap-6 lg:grid-cols-[minmax(320px,0.95fr)_minmax(420px,1fr)]">
          <div className="flex min-h-[260px] items-center justify-center rounded-md border border-border bg-muted/15 p-4">
            {item.figureImageUrl ? (
              <StructuredMathFigure item={item} index={currentIndex} quiz />
            ) : (
              <div className="text-center text-sm text-muted-foreground">
                <FunctionSquare className="mx-auto mb-2 h-8 w-8" />
                도형 이미지 없음
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col">
            <div className="rounded-md border border-border bg-muted/25 p-4 text-[15px] font-semibold leading-7">
              <MathText text={item.prompt} />
            </div>
            <StructuredMathChoices
              item={item}
              variant="quiz"
              selectedAnswer={selectedAnswers[currentIndex] ?? null}
              onSelectAnswer={(answer) => onSelectAnswer(currentIndex, answer)}
            />
            <div className="mt-auto flex items-center justify-between gap-3 pt-5">
              <button
                type="button"
                disabled={currentIndex === 0}
                onClick={() => onChangeQuizIndex(currentIndex - 1)}
                className="inline-flex h-10 items-center gap-2 rounded-md border border-border px-4 text-sm font-semibold hover:bg-accent disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                이전 문제
              </button>
              <button
                type="button"
                disabled={currentIndex === sheet.items.length - 1}
                onClick={() => onChangeQuizIndex(currentIndex + 1)}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-40"
              >
                다음 문제
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <aside className="flex h-[700px] min-h-0 flex-col rounded-md border border-border bg-white p-4">
        <div className="shrink-0 rounded-md border border-border bg-muted/20 px-3 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-bold">답안표</span>
            <span className="rounded bg-foreground px-2 py-0.5 text-xs font-bold text-background">
              {solvedCount} / {sheet.items.length}
            </span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">
            입력 {answeredCount} · 미입력 {pendingCount}
          </p>
        </div>
        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-1">
          <div className="grid grid-cols-[52px_74px_72px] items-center border-b border-border px-2 pb-2 text-[11px] font-bold text-muted-foreground">
            <span>문항</span>
            <span className="text-center">선택 답</span>
            <span className="text-right">상태</span>
          </div>
          {sheet.items.map((navItem, i) => {
            const active = i === currentIndex;
            const selectedAnswer = selectedAnswers[i];
            return (
              <button
                key={i}
                ref={active ? activeNumberRef : null}
                type="button"
                onClick={() => onChangeQuizIndex(i)}
                className={`mt-2 grid min-h-12 w-full grid-cols-[52px_74px_72px] items-center rounded-md border px-2 text-left text-sm ${
                  active
                    ? "border-primary bg-primary text-primary-foreground"
                    : selectedAnswer
                      ? "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100"
                      : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
                aria-label={`${navItem.questionNumber ?? i + 1}번 문항으로 이동`}
              >
                <span className="font-bold">{navItem.questionNumber ?? i + 1}</span>
                <span className="flex justify-center">
                  {selectedAnswer ? (
                    <span
                      className={`inline-flex h-7 min-w-9 items-center justify-center rounded border px-2 text-sm font-bold ${
                        active
                          ? "border-white/55 bg-transparent text-primary-foreground"
                          : "border-emerald-300 bg-transparent text-emerald-800"
                      }`}
                    >
                      {selectedAnswer}
                    </span>
                  ) : (
                    <span className={active ? "font-bold text-primary-foreground/75" : "font-semibold text-muted-foreground/70"}>-</span>
                  )}
                </span>
                <span
                  className={`justify-self-end text-[11px] font-bold ${
                    active
                      ? "text-primary-foreground/85"
                      : selectedAnswer
                        ? "text-emerald-700"
                        : "text-muted-foreground"
                  }`}
                >
                  {selectedAnswer ? "입력" : "미입력"}
                </span>
              </button>
            );
          })}
        </div>
      </aside>
    </div>
  );
}

function StructuredMathMeta({ item, index }: { item: StructuredMathSheet["items"][number]; index: number }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <span className="rounded bg-foreground px-2 py-0.5 font-bold text-background">{item.questionNumber ?? index + 1}번</span>
      {item.subject && <span className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground">{item.subject}</span>}
      {item.type && <span className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground">{item.type}</span>}
      {item.points != null && <span className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground">{item.points}점</span>}
      {item.answer && (
        <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">정답 {item.answer}</span>
      )}
      {item.needsReview && (
        <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">검수 필요</span>
      )}
    </div>
  );
}

function StructuredMathFigure({
  item,
  index,
  exam,
  quiz,
}: {
  item: StructuredMathSheet["items"][number];
  index: number;
  exam?: boolean;
  quiz?: boolean;
}) {
  if (!item.figureImageUrl) return null;
  return (
    <img
      src={item.figureImageUrl}
      alt={`${item.questionNumber ?? index + 1}번 도형`}
      className={
        quiz
          ? "max-h-[360px] max-w-full object-contain"
          : exam
            ? "mt-4 max-h-80 max-w-full border border-border bg-white"
            : "mt-3 max-h-72 rounded border border-border bg-white"
      }
      loading="lazy"
    />
  );
}

function StructuredMathChoices({
  item,
  variant,
  selectedAnswer,
  onSelectAnswer,
}: {
  item: StructuredMathSheet["items"][number];
  variant: PreviewMode;
  selectedAnswer?: string | null;
  onSelectAnswer?: (answer: string) => void;
}) {
  if (item.choices.length === 0) return null;

  return (
    <ul className={variant === "exam" ? "mt-4 grid gap-x-5 gap-y-2 text-[15px] sm:grid-cols-2" : "mt-3 space-y-1.5 text-sm"}>
      {item.choices.map((choice, choiceIndex) => {
        const mark = CHOICE_MARKS[choiceIndex] ?? `${choiceIndex + 1}.`;
        const isAnswer = isStructuredMathAnswer(item.answer, mark, choiceIndex);
        const isSelected = selectedAnswer === mark;
        const itemClassName =
          variant === "quiz"
            ? isSelected
              ? "flex cursor-pointer gap-2 rounded border-2 border-foreground bg-background px-2 py-2 font-semibold text-foreground shadow-sm"
              : "flex cursor-pointer gap-2 rounded border-2 border-transparent px-2 py-2 hover:border-border hover:bg-accent/50"
            : isAnswer
              ? "flex gap-2 rounded border border-emerald-300 bg-emerald-50 px-2 py-1 font-medium text-emerald-800"
              : "flex gap-2 px-2 py-1";
        return (
          <li
            key={choiceIndex}
            role={variant === "quiz" ? "button" : undefined}
            tabIndex={variant === "quiz" ? 0 : undefined}
            onClick={variant === "quiz" ? () => onSelectAnswer?.(mark) : undefined}
            onKeyDown={
              variant === "quiz"
                ? (event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelectAnswer?.(mark);
                    }
                  }
                : undefined
            }
            className={itemClassName}
          >
            <span className="shrink-0">{mark}</span>
            <MathText text={choice} />
          </li>
        );
      })}
    </ul>
  );
}

function isStructuredMathAnswer(answer: string | null, mark: string, choiceIndex: number) {
  if (!answer) return false;
  const normalized = answer.trim();
  return normalized === mark || normalized === String(choiceIndex + 1);
}

function clampQuestionIndex(index: number, itemCount: number) {
  if (itemCount <= 0) return 0;
  if (Number.isNaN(index)) return 0;
  return Math.min(Math.max(index, 0), itemCount - 1);
}

function parseStructuredMathHash(): StructuredMathHash | null {
  if (typeof window === "undefined") return null;
  const hash = window.location.hash.replace(/^#/, "");
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const sheetId = params.get("sheet");
  if (!sheetId) return null;
  const rawMode = params.get("mode");
  const mode: PreviewMode = rawMode === "quiz" ? "quiz" : "exam";
  const questionNumber = Number(params.get("q") ?? "1");
  return {
    sheetId,
    mode,
    questionIndex: Number.isFinite(questionNumber) ? Math.max(questionNumber - 1, 0) : 0,
  };
}

function replaceStructuredMathHash(sheetId: string, mode: PreviewMode, questionIndex: number) {
  if (typeof window === "undefined") return;
  const params = new URLSearchParams();
  params.set("sheet", sheetId);
  params.set("mode", mode);
  if (mode === "quiz") params.set("q", String(questionIndex + 1));
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}#${params.toString()}`);
}

function clearStructuredMathHash() {
  if (typeof window === "undefined") return;
  window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
}
