"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Loader2, X } from "lucide-react";
import { extractedSheetApi } from "@/entities/extracted-sheet/api/extractedSheetApi";
import { questionApi, type QuestionResponse } from "@/entities/question/api/questionApi";
import { toast, toastError } from "@/shared/lib/toast";

type ItemState = { checked: boolean; answer: string };

/**
 * 시험지 빌더에서 PDF 추출 시험지를 골라 독해 문항을 시험지에 추가하는 다이얼로그.
 * 체크 + (AI가 미리 채운) 정답 라디오 → 문제 은행(영어>읽기)에 등록 후 시험지에 추가.
 */
export function ExamPdfExtractDialog({
  open,
  onClose,
  readingCategoryId,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  readingCategoryId: number | null;
  onAdded: (questions: QuestionResponse[]) => void;
}) {
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [states, setStates] = useState<Record<number, ItemState>>({});

  const { data: sheets = [] } = useQuery({
    queryKey: ["extracted-sheets"],
    queryFn: extractedSheetApi.list,
    enabled: open,
  });
  const { data: sheet, isLoading } = useQuery({
    queryKey: ["extracted-sheets", sheetId],
    queryFn: () => extractedSheetApi.get(sheetId as string),
    enabled: open && sheetId != null,
  });

  // 시트가 바뀌면 각 문항 기본값(체크 해제 + AI 정답) 세팅
  useEffect(() => {
    if (!sheet) return;
    const next: Record<number, ItemState> = {};
    sheet.items.forEach((it, i) => {
      next[i] = { checked: true, answer: it.answer ?? it.choices[0] ?? "" };
    });
    setStates(next);
  }, [sheet]);

  const checkedCount = useMemo(
    () => Object.values(states).filter((s) => s.checked).length,
    [states],
  );

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!sheet || readingCategoryId == null) return [] as QuestionResponse[];
      const picks = sheet.items
        .map((it, i) => ({ it, i }))
        .filter(({ i }) => states[i]?.checked);
      return Promise.all(
        picks.map(({ it, i }) =>
          questionApi.create({
            questionType: "MULTIPLE_CHOICE",
            questionKind: "MAIN_IDEA",
            sourceType: "CUSTOM",
            sourceName: "PDF 추출",
            categoryId: readingCategoryId,
            difficulty: "medium",
            question: it.prompt,
            passage: it.passage,
            choices: it.choices,
            answer: states[i]?.answer || it.answer || it.choices[0],
            explanation: it.explanation || "해설은 검수 단계에서 입력하세요.",
            keywords: [],
          }),
        ),
      );
    },
    onSuccess: (created) => {
      if (created.length) {
        onAdded(created);
        toast.success(`${created.length}문항을 시험지에 추가했습니다.`);
        onClose();
      }
    },
    onError: (e) => toastError(e, "문항 추가에 실패했습니다."),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <div className="flex min-w-0 items-center gap-2">
            {sheetId && (
              <button
                type="button"
                onClick={() => setSheetId(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
                aria-label="목록으로"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="truncate text-base font-bold">PDF 추출 문항 추가</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {sheetId ? "체크한 문항이 문제 은행(영어 > 읽기)에 등록되고 시험지에 추가됩니다." : "추출 시험지를 선택하세요."}
              </p>
            </div>
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

        {readingCategoryId == null && (
          <div className="border-b border-amber-200 bg-amber-50 px-5 py-2.5 text-xs text-amber-800">
            영어 &gt; 읽기 분류를 찾지 못했습니다. 백엔드 재시작 후 다시 시도하세요.
          </div>
        )}

        <div className="max-h-[68vh] overflow-y-auto p-5">
          {/* 시트 목록 */}
          {!sheetId ? (
            sheets.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                추출된 시험지가 없습니다. 먼저 문제 추출기에서 PDF를 추출하세요.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {sheets.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSheetId(s.id)}
                    className="flex items-start gap-3 rounded-lg border border-border bg-background p-4 text-left transition-shadow hover:shadow-md"
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{s.title}</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">읽기 {s.itemCount}문항</span>
                    </span>
                  </button>
                ))}
              </div>
            )
          ) : isLoading || !sheet ? (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              불러오는 중
            </div>
          ) : (
            <ol className="space-y-3">
              {sheet.items.map((item, i) => {
                const st = states[i] ?? { checked: false, answer: item.answer ?? "" };
                return (
                  <li
                    key={i}
                    className={`rounded-md border p-4 transition-colors ${
                      st.checked ? "border-primary bg-primary/5" : "border-border bg-muted/20"
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-2">
                      <input
                        type="checkbox"
                        checked={st.checked}
                        onChange={(e) =>
                          setStates((cur) => ({ ...cur, [i]: { ...st, checked: e.target.checked } }))
                        }
                        className="mt-1 h-4 w-4"
                      />
                      <span className="text-sm font-semibold">
                        {item.questionNumber != null && (
                          <span className="mr-1.5 text-muted-foreground">{item.questionNumber}.</span>
                        )}
                        {item.prompt}
                      </span>
                    </label>
                    {item.passage && (
                      <p className="mt-2 whitespace-pre-line rounded border border-border bg-background p-3 text-xs leading-6 text-muted-foreground">
                        {item.passage}
                      </p>
                    )}
                    <div className="mt-2 space-y-1">
                      {item.choices.map((choice, ci) => (
                        <label
                          key={ci}
                          className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm ${
                            st.answer === choice ? "bg-emerald-50 font-medium text-emerald-800" : "text-foreground"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`ans-${i}`}
                            checked={st.answer === choice}
                            onChange={() => setStates((cur) => ({ ...cur, [i]: { ...st, answer: choice } }))}
                            className="h-3.5 w-3.5"
                          />
                          {choice}
                          {st.answer === choice && <span className="ml-1 text-[10px] font-bold text-emerald-700">AI 정답</span>}
                        </label>
                      ))}
                    </div>
                    {item.explanation && (
                      <p className="mt-2 rounded border border-border bg-background p-2 text-xs leading-5 text-muted-foreground">
                        <span className="font-semibold text-foreground">해설</span> · {item.explanation}
                      </p>
                    )}
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        {sheetId && sheet && (
          <div className="flex items-center justify-between border-t border-border bg-muted/25 px-5 py-3">
            <span className="text-sm text-muted-foreground">{checkedCount}개 선택됨</span>
            <button
              type="button"
              disabled={checkedCount === 0 || readingCategoryId == null || addMutation.isPending}
              onClick={() => addMutation.mutate()}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {addMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              선택 {checkedCount}개 시험지에 추가
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
