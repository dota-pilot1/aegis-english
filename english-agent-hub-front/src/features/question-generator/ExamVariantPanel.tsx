"use client";

import { useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, Copy, Loader2, Wand2 } from "lucide-react";
import { examApi, type ExamResponse } from "@/entities/exam/api/examApi";
import { toast, toastError } from "@/shared/lib/toast";

/**
 * 시험지 통째 변형 MVP — 기존 시험지를 골라 문항별로 동형 새 문항을 생성하고
 * 같은 구조(배점·순서)의 새 DRAFT 시험지를 만든다.
 */
export function ExamVariantPanel() {
  const [selectedId, setSelectedId] = useState<string>("");
  const [result, setResult] = useState<ExamResponse | null>(null);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: examApi.list,
  });

  const variantMutation = useMutation({
    mutationFn: (id: string) => examApi.generateVariant(id),
    onSuccess: (exam) => {
      setResult(exam);
      toast.success(`변형 시험지 "${exam.title}"를 생성했습니다. (${exam.itemCount}문항)`);
    },
    onError: (e) => toastError(e, "시험지 변형에 실패했습니다."),
  });

  const selected = exams.find((e) => e.id === selectedId);

  return (
    <section className="rounded-lg border border-border bg-background p-5">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-primary bg-primary text-primary-foreground">
          <Wand2 className="h-4 w-4" />
        </span>
        <div>
          <h2 className="text-base font-bold">시험지 통째 변형 <span className="text-xs font-medium text-muted-foreground">MVP</span></h2>
          <p className="text-xs text-muted-foreground">
            기존 시험지를 고르면 문항별로 동형(同形) 새 문항을 생성해 같은 구조의 변형본 시험지를 만듭니다.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
        <label className="flex-1">
          <span className="mb-1 block text-xs font-semibold text-muted-foreground">원본 시험지</span>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            disabled={isLoading || variantMutation.isPending}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-50"
          >
            <option value="">{isLoading ? "불러오는 중…" : "시험지를 선택하세요"}</option>
            {exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {exam.title} · {exam.itemCount}문항 · {exam.status}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={!selectedId || variantMutation.isPending}
          onClick={() => {
            setResult(null);
            variantMutation.mutate(selectedId);
          }}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {variantMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
          변형본 생성
        </button>
      </div>

      {selected && !variantMutation.isPending && !result && (
        <p className="mt-3 text-xs text-muted-foreground">
          “{selected.title}”의 {selected.itemCount}개 문항 각각을 LLM으로 새로 생성합니다. 문항 수만큼 시간이 걸립니다.
        </p>
      )}

      {variantMutation.isPending && (
        <p className="mt-3 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          문항별로 동형 문제를 생성하는 중입니다…
        </p>
      )}

      {result && (
        <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-sm font-semibold text-emerald-800">변형본이 DRAFT로 생성되었습니다.</p>
          <p className="mt-1 text-xs text-emerald-700">
            {result.title} · {result.itemCount}문항 · 총 {result.totalPoints}점
          </p>
          <Link
            href="/exams"
            className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md border border-emerald-300 bg-background px-3 text-sm font-semibold text-emerald-800 transition-colors hover:bg-emerald-100"
          >
            시험 출제에서 검수·발행
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </section>
  );
}
