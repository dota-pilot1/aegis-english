"use client";

import { ChangeEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Calculator, FileText, Loader2, Trash2, Upload, X } from "lucide-react";
import {
  extractedMathSheetApi,
  type ExtractedMathSheet,
} from "@/entities/extracted-math-sheet/api/extractedMathSheetApi";
import { toast, toastError } from "@/shared/lib/toast";

const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

export function MathExtractorUploadPanel() {
  const qc = useQueryClient();
  const [problem, setProblem] = useState<File | null>(null);
  const [answer, setAnswer] = useState<File | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data: sheets = [] } = useQuery({
    queryKey: ["extracted-math-sheets"],
    queryFn: extractedMathSheetApi.list,
  });

  const { data: openSheet, isLoading: openLoading } = useQuery({
    queryKey: ["extracted-math-sheets", openId],
    queryFn: () => extractedMathSheetApi.get(openId as string),
    enabled: openId != null,
  });

  const createMutation = useMutation({
    mutationFn: () => extractedMathSheetApi.create(problem as File, answer),
    onSuccess: (sheet) => {
      toast.success(`"${sheet.title}" 추출 완료 — ${sheet.itemCount}문항`);
      qc.invalidateQueries({ queryKey: ["extracted-math-sheets"] });
      setOpenId(sheet.id);
    },
    onError: (e) => toastError(e, "수학 문항 추출에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => extractedMathSheetApi.delete(id),
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["extracted-math-sheets"] });
      if (openId === id) setOpenId(null);
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
              <Calculator className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-base font-bold">수학 시험지 업로드</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                수식·도형이 깨지지 않도록 문항을 원본 이미지로 잘라 저장합니다.
              </p>
            </div>
          </div>

          <label className="mt-5 flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/35 px-4 py-6 text-center transition-colors hover:border-primary hover:bg-accent">
            <Upload className="h-7 w-7 text-muted-foreground" />
            <span className="mt-2 text-sm font-semibold">문제 PDF 선택 (필수)</span>
            <span className="mt-1 text-xs text-muted-foreground">디지털 PDF · 페이지를 이미지로 렌더해 문항을 감지합니다</span>
            <input type="file" accept="application/pdf" onChange={pickProblem} className="sr-only" />
          </label>

          <label className="mt-3 flex min-h-20 cursor-pointer flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 px-4 py-4 text-center transition-colors hover:border-primary hover:bg-accent">
            <span className="text-sm font-semibold">정답 PDF 선택 (선택)</span>
            <span className="mt-1 text-xs text-muted-foreground">정답표를 읽어 문항별 정답·배점을 자동 매핑합니다</span>
            <input type="file" accept="application/pdf" onChange={pickAnswer} className="sr-only" />
          </label>

          <div className="mt-4 rounded-md border border-border bg-muted/25 p-3 text-xs leading-5 text-muted-foreground">
            발문·도형·보기가 한 장에 세로로 담깁니다. 정답·배점은 검수 단계에서 수정할 수 있습니다.
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
            disabled={!problemIsPdf || createMutation.isPending}
            onClick={() => createMutation.mutate()}
            className="mt-4 inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Calculator className="h-4 w-4" />}
            수학 문항 추출
          </button>
          {problem && !problemIsPdf && (
            <p className="mt-2 text-xs text-destructive">문제 파일은 PDF만 지원합니다.</p>
          )}
        </aside>
      </div>

      {createMutation.isPending && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-background p-5 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          페이지를 이미지로 렌더하고 문항을 잘라내는 중입니다… (페이지 수에 따라 수십 초 걸릴 수 있어요)
        </div>
      )}

      {sheets.length > 0 && (
        <div className="rounded-lg border border-border bg-background p-5">
          <h2 className="text-base font-bold">
            추출 시험지 <span className="text-sm font-medium text-muted-foreground">{sheets.length}개</span>
          </h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {sheets.map((sheet) => (
              <MathSheetCard
                key={sheet.id}
                sheet={sheet}
                onOpen={() => setOpenId(sheet.id)}
                onDelete={() => deleteMutation.mutate(sheet.id)}
                deleting={deleteMutation.isPending && deleteMutation.variables === sheet.id}
              />
            ))}
          </div>
        </div>
      )}

      {openId && (
        <MathSheetDetailModal sheet={openSheet ?? null} loading={openLoading} onClose={() => setOpenId(null)} />
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

function MathSheetCard({
  sheet,
  onOpen,
  onDelete,
  deleting,
}: {
  sheet: ExtractedMathSheet;
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
          <Calculator className="h-4 w-4" />
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
          title="삭제"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <h3 className="mt-3 truncate text-sm font-bold" title={sheet.title}>
        {sheet.title}
      </h3>
      <p className="mt-1 text-xs text-muted-foreground">{sheet.itemCount}문항</p>
      <p className="mt-3 text-xs text-muted-foreground">{new Date(sheet.createdAt).toLocaleString()}</p>
    </div>
  );
}

function MathSheetDetailModal({
  sheet,
  loading,
  onClose,
}: {
  sheet: ExtractedMathSheet | null;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-12"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{sheet?.title ?? "불러오는 중"}</h2>
            {sheet && (
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sheet.itemCount}문항 · 발문·도형·보기를 원본 이미지로 보관
              </p>
            )}
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

        <div className="max-h-[72vh] overflow-y-auto p-5">
          {loading || !sheet ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              불러오는 중
            </div>
          ) : (
            <ol className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {sheet.items.map((item, i) => (
                <li key={i} className="rounded-md border border-border bg-muted/20 p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    {item.questionNumber != null && (
                      <span className="rounded bg-foreground px-2 py-0.5 font-bold text-background">
                        {item.questionNumber}번
                      </span>
                    )}
                    {item.subject && (
                      <span className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground">
                        {item.subject}
                      </span>
                    )}
                    {item.type && (
                      <span className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground">
                        {item.type}
                      </span>
                    )}
                    {item.points != null && (
                      <span className="rounded border border-border bg-background px-2 py-0.5 text-muted-foreground">
                        {item.points}점
                      </span>
                    )}
                    {item.answer && (
                      <span className="rounded border border-emerald-300 bg-emerald-50 px-2 py-0.5 font-bold text-emerald-800">
                        정답 {item.answer}
                      </span>
                    )}
                    {item.hasFigure && (
                      <span className="rounded border border-sky-300 bg-sky-50 px-2 py-0.5 text-sky-700">도형</span>
                    )}
                    {item.needsReview && (
                      <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 font-medium text-amber-800">
                        검수 필요
                      </span>
                    )}
                  </div>
                  {/* 발문 → 도형 → 보기가 원본 레이아웃 그대로 한 장에 세로 정렬 */}
                  <img
                    src={item.imageUrl}
                    alt={`${item.questionNumber ?? i + 1}번 문항`}
                    className="mt-3 w-full rounded border border-border bg-white"
                    loading="lazy"
                  />
                  {item.text && (
                    <details className="mt-2 text-xs text-muted-foreground">
                      <summary className="cursor-pointer select-none">추출 텍스트 (검색·검수용)</summary>
                      <pre className="mt-1 whitespace-pre-wrap rounded border border-border bg-background p-2 font-sans leading-5">
                        {item.text}
                      </pre>
                    </details>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
