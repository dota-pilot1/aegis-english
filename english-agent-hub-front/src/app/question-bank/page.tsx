"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BookOpenCheck,
  Check,
  ChevronRight,
  CircleAlert,
  Clock,
  FolderPlus,
  Layers,
  Loader2,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import { useConfirm } from "@/shared/ui/useConfirm";
import { buildCategoryTree, categoryApi, type CategoryNode } from "@/entities/category/api/categoryApi";
import { questionApi } from "@/entities/question/api/questionApi";
import { toast, toastError } from "@/shared/lib/toast";

const subjectPalette = [
  "border-sky-200 bg-sky-50 text-sky-700",
  "border-amber-200 bg-amber-50 text-amber-700",
  "border-emerald-200 bg-emerald-50 text-emerald-700",
  "border-violet-200 bg-violet-50 text-violet-700",
  "border-rose-200 bg-rose-50 text-rose-700",
];

type SubjectEditorState = {
  mode: "create" | "rename";
  /** rename 시 대상 과목 */
  target: CategoryNode | null;
  value: string;
};

export default function QuestionBankPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <QuestionBankHub />
    </RequireRole>
  );
}

function QuestionBankHub() {
  const qc = useQueryClient();
  const router = useRouter();
  const { confirm, confirmDialog } = useConfirm();
  const [editor, setEditor] = useState<SubjectEditorState | null>(null);
  const [confirmEmbedKind, setConfirmEmbedKind] = useState<null | "PENDING" | "FAILED">(null);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["question-categories"],
    queryFn: categoryApi.list,
  });

  const subjects = useMemo(() => buildCategoryTree(categories), [categories]);

  const { data: embeddingStatus } = useQuery({
    queryKey: ["questions", "embedding-status"],
    queryFn: () => questionApi.embeddingStatus(),
    refetchInterval: 30000,
  });

  const createMutation = useMutation({
    mutationFn: (name: string) => categoryApi.create({ parentId: null, name }),
    onSuccess: () => {
      toast.success("과목을 추가했습니다.");
      qc.invalidateQueries({ queryKey: ["question-categories"] });
      setEditor(null);
    },
    onError: (e) => toastError(e, "과목 추가에 실패했습니다."),
  });

  const renameMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => categoryApi.rename(id, name),
    onSuccess: () => {
      toast.success("과목 이름을 변경했습니다.");
      qc.invalidateQueries({ queryKey: ["question-categories"] });
      qc.invalidateQueries({ queryKey: ["questions"] });
      setEditor(null);
    },
    onError: (e) => toastError(e, "이름 변경에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: categoryApi.delete,
    onSuccess: () => {
      toast.success("과목을 삭제했습니다.");
      qc.invalidateQueries({ queryKey: ["question-categories"] });
    },
    onError: (e) => toastError(e, "과목 삭제에 실패했습니다."),
  });

  const embedMutation = useMutation({
    mutationFn: () => questionApi.embedPending(50),
    onSuccess: (result) => {
      if (result.picked === 0) {
        toast.success("임베딩 대기 중인 문제가 없습니다.");
      } else {
        toast.success(
          `임베딩 ${result.completed}건 완료${result.failed > 0 ? `, ${result.failed}건 실패` : ""}` +
            (result.stillPending > 0 ? ` (남은 대기 ${result.stillPending}건)` : ""),
        );
      }
      qc.invalidateQueries({ queryKey: ["questions"] });
      setConfirmEmbedKind(null);
    },
    onError: (e) => {
      toastError(e, "임베딩 배치에 실패했습니다.");
      setConfirmEmbedKind(null);
    },
  });

  const submitEditor = () => {
    if (!editor) return;
    const name = editor.value.trim();
    if (!name) return;
    if (editor.mode === "create") {
      createMutation.mutate(name);
    } else if (editor.target) {
      renameMutation.mutate({ id: editor.target.id, name });
    }
  };

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto w-full max-w-[1100px] space-y-6">
        <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
              <BookOpenCheck className="h-4 w-4" />
              Question Bank PoC
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">문제 은행</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              과목을 선택해 분류 트리와 문제를 관리합니다. 과목은 카테고리 트리의 최상위 노드입니다.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <EmbeddingCountCard
              kind="PENDING"
              count={embeddingStatus?.pending ?? 0}
              onClick={() => setConfirmEmbedKind("PENDING")}
            />
            <EmbeddingCountCard kind="COMPLETED" count={embeddingStatus?.completed ?? 0} />
            <EmbeddingCountCard
              kind="FAILED"
              count={embeddingStatus?.failed ?? 0}
              onClick={() => setConfirmEmbedKind("FAILED")}
            />
          </div>
        </section>

        <section>
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold">과목 ({subjects.length})</h2>
            <button
              type="button"
              onClick={() => setEditor({ mode: "create", target: null, value: "" })}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <FolderPlus className="h-4 w-4" />
              과목 추가
            </button>
          </div>

          {isLoading ? (
            <div className="mt-4 flex h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              불러오는 중
            </div>
          ) : subjects.length === 0 ? (
            <div className="mt-4 flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <Layers className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">아직 과목이 없습니다.</p>
              <p className="mt-1 text-xs text-muted-foreground">우측 상단 버튼으로 첫 과목을 추가하세요.</p>
            </div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {subjects.map((subject, index) => (
                <div
                  key={subject.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/question-bank/subject?id=${subject.id}`)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      router.push(`/question-bank/subject?id=${subject.id}`);
                    }
                  }}
                  className="group cursor-pointer rounded-lg border border-border bg-background p-4 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-ring"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-md border px-2.5 py-1 text-sm font-bold ${
                        subjectPalette[index % subjectPalette.length]
                      }`}
                    >
                      {subject.name}
                    </span>
                    <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditor({ mode: "rename", target: subject, value: subject.name });
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                        aria-label={`${subject.name} 이름 변경`}
                        title="이름 변경"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (await confirm({
                            title: "과목 삭제",
                            description: `"${subject.name}" 과목을 삭제할까요?\n하위 분류나 문제가 있으면 삭제할 수 없습니다.`,
                            confirmText: "삭제",
                            variant: "destructive",
                          })) {
                            deleteMutation.mutate(subject.id);
                          }
                        }}
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive hover:text-white"
                        aria-label={`${subject.name} 삭제`}
                        title="삭제"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 flex items-end justify-between">
                    <div>
                      <p className="text-3xl font-bold tabular-nums">{subject.subtreeCount}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        문제 · 하위 분류 {subject.children.length}개
                      </p>
                    </div>
                    <span className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground transition-colors group-hover:text-foreground">
                      관리
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {editor && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-24"
          onClick={(e) => {
            if (e.target === e.currentTarget) setEditor(null);
          }}
        >
          <div className="w-full max-w-sm overflow-hidden rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
              <h2 className="text-base font-bold tracking-tight">
                {editor.mode === "create" ? "과목 추가" : `"${editor.target?.name}" 이름 변경`}
              </h2>
              <button
                type="button"
                onClick={() => setEditor(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="p-5">
              <input
                autoFocus
                value={editor.value}
                onChange={(e) => setEditor((cur) => (cur ? { ...cur, value: e.target.value } : cur))}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    submitEditor();
                  }
                }}
                placeholder="과목 이름 (예: 수학)"
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditor(null)}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={submitEditor}
                  disabled={!editor.value.trim() || createMutation.isPending || renameMutation.isPending}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {(createMutation.isPending || renameMutation.isPending) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}
                  {editor.mode === "create" ? "추가" : "변경"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmEmbedKind !== null}
        title={confirmEmbedKind === "FAILED" ? "실패한 임베딩을 다시 시도할까요?" : "임베딩을 진행할까요?"}
        description={
          confirmEmbedKind === "FAILED"
            ? `실패 상태인 문제 ${embeddingStatus?.failed ?? 0}건을 다시 임베딩합니다.`
            : `대기 상태인 문제 ${embeddingStatus?.pending ?? 0}건을 OpenAI로 임베딩합니다.`
        }
        confirmText="임베딩 진행"
        loading={embedMutation.isPending}
        onConfirm={() => embedMutation.mutate()}
        onCancel={() => setConfirmEmbedKind(null)}
      />
      {confirmDialog}
    </main>
  );
}

function EmbeddingCountCard({
  kind,
  count,
  onClick,
}: {
  kind: "PENDING" | "COMPLETED" | "FAILED";
  count: number;
  onClick?: () => void;
}) {
  const meta = {
    PENDING: {
      label: "대기",
      tone: "border-amber-200 bg-amber-50 text-amber-700",
      Icon: Clock,
    },
    COMPLETED: {
      label: "완료",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-700",
      Icon: Check,
    },
    FAILED: {
      label: "실패",
      tone: "border-red-200 bg-red-50 text-red-700",
      Icon: CircleAlert,
    },
  }[kind];

  const clickable = !!onClick && count > 0;
  const Tag = clickable ? "button" : "div";
  const interactiveCls = clickable
    ? "cursor-pointer transition-colors hover:brightness-95"
    : count === 0
      ? "opacity-60"
      : "";

  return (
    <Tag
      type={clickable ? "button" : undefined}
      onClick={clickable ? onClick : undefined}
      className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-2.5 text-sm font-semibold ${meta.tone} ${interactiveCls}`}
      title={clickable ? `${meta.label} ${count}건 임베딩` : undefined}
    >
      <meta.Icon className="h-3.5 w-3.5" />
      <span>{meta.label}</span>
      <span className="rounded bg-background/60 px-1.5 py-0.5 text-xs font-bold tabular-nums">
        {count}
      </span>
    </Tag>
  );
}
