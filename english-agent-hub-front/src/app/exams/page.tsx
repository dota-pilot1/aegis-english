"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ClipboardList,
  FilePlus2,
  Layers,
  Loader2,
  Pencil,
  PlayCircle,
  Send,
  Lock,
  Trash2,
  X,
} from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import { ConfirmDialog } from "@/shared/ui/ConfirmDialog";
import {
  buildExamCategoryTree,
  examApi,
  examCategoryApi,
  flattenExamCategoryTree,
  type ExamCategoryNode,
  type ExamResponse,
  type ExamStatus,
} from "@/entities/exam/api/examApi";
import { buildCategoryTree, categoryApi } from "@/entities/category/api/categoryApi";
import { toast, toastError } from "@/shared/lib/toast";

export default function ExamsPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <ExamsWorkspace />
    </RequireRole>
  );
}

const STATUS_META: Record<ExamStatus, { label: string; tone: string }> = {
  DRAFT: { label: "작성 중", tone: "border-amber-200 bg-amber-50 text-amber-700" },
  PUBLISHED: { label: "발행됨", tone: "border-emerald-200 bg-emerald-50 text-emerald-700" },
  CLOSED: { label: "마감", tone: "border-slate-200 bg-slate-100 text-slate-600" },
};

type CreateState = {
  title: string;
  description: string;
  timeLimit: string;
  subjectId: number | null;
  examCategoryId: number | null;
};

const ALL = "all" as const;
const UNCLASSIFIED = "none";

function descendantIdsByCategory(roots: ExamCategoryNode[]) {
  const map = new Map<number, Set<number>>();
  const walk = (node: ExamCategoryNode): Set<number> => {
    const ids = new Set<number>([node.id]);
    node.children.forEach((child) => {
      walk(child).forEach((id) => ids.add(id));
    });
    map.set(node.id, ids);
    return ids;
  };
  roots.forEach(walk);
  return map;
}

function ExamsWorkspace() {
  const qc = useQueryClient();
  const router = useRouter();
  const [create, setCreate] = useState<CreateState | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<ExamResponse | null>(null);
  const [subject, setSubject] = useState<string>(ALL);

  const { data: exams = [], isLoading } = useQuery({
    queryKey: ["exams"],
    queryFn: examApi.list,
  });

  const { data: categoryRecords = [] } = useQuery({
    queryKey: ["question-categories"],
    queryFn: () => categoryApi.list(),
  });
  const { data: examCategoryRecords = [] } = useQuery({
    queryKey: ["exam-categories"],
    queryFn: () => examCategoryApi.list(),
  });
  const examCategoryTree = useMemo(() => buildExamCategoryTree(examCategoryRecords), [examCategoryRecords]);
  const descendantIds = useMemo(() => descendantIdsByCategory(examCategoryTree), [examCategoryTree]);
  const uncategorizedCount = exams.filter((exam) => exam.examCategoryId == null).length;

  const visibleExams = useMemo(() => {
    if (subject === ALL) return exams;
    if (subject === UNCLASSIFIED) return exams.filter((exam) => exam.examCategoryId == null);
    const ids = descendantIds.get(Number(subject)) ?? new Set([Number(subject)]);
    return exams.filter((exam) => exam.examCategoryId != null && ids.has(exam.examCategoryId));
  }, [descendantIds, exams, subject]);

  // 최상위 분류 = 과목
  const subjects = useMemo(
    () => buildCategoryTree(categoryRecords).map((node) => ({ id: node.id, name: node.name })),
    [categoryRecords],
  );
  const examCategoryOptions = useMemo(
    () => flattenExamCategoryTree(examCategoryTree),
    [examCategoryTree],
  );

  const invalidate = () => qc.invalidateQueries({ queryKey: ["exams"] });

  const createMutation = useMutation({
    mutationFn: (s: CreateState) =>
      examApi.create({
        title: s.title.trim(),
        description: s.description.trim() || undefined,
        timeLimitMinutes: s.timeLimit ? Number(s.timeLimit) : null,
        subjectId: s.subjectId,
        examCategoryId: s.examCategoryId,
        items: [],
      }),
    onSuccess: (exam) => {
      toast.success("시험지를 만들었습니다. 문항을 추가하세요.");
      invalidate();
      setCreate(null);
      router.push(`/exams/build?id=${exam.id}`);
    },
    onError: (e) => toastError(e, "시험지 생성에 실패했습니다."),
  });

  const publishMutation = useMutation({
    mutationFn: (id: string) => examApi.publish(id),
    onSuccess: () => {
      toast.success("시험지를 발행했습니다.");
      invalidate();
    },
    onError: (e) => toastError(e, "발행에 실패했습니다. 문항이 있는지 확인하세요."),
  });

  const closeMutation = useMutation({
    mutationFn: (id: string) => examApi.close(id),
    onSuccess: () => {
      toast.success("시험지를 마감했습니다.");
      invalidate();
    },
    onError: (e) => toastError(e, "마감에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => examApi.delete(id),
    onSuccess: () => {
      toast.success("시험지를 삭제했습니다.");
      invalidate();
      setConfirmDelete(null);
    },
    onError: (e) => {
      toastError(e, "삭제에 실패했습니다.");
      setConfirmDelete(null);
    },
  });

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-3 py-5 sm:px-4">
      <div className="grid w-full gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
        <SubjectSidebar
          categories={examCategoryTree}
          total={exams.length}
          uncategorizedCount={uncategorizedCount}
          selected={subject}
          onSelect={setSubject}
        />

        <section className="min-w-0 space-y-6">
          <div className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="min-w-0">
              <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
                <ClipboardList className="h-4 w-4" />
                Exam
              </div>
              <h1 className="mt-3 text-2xl font-bold tracking-tight">시험 출제</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                문제 은행의 문제로 시험지를 구성하고 발행합니다. 발행된 시험은 응시·자동 채점됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setCreate({ title: "", description: "", timeLimit: "", subjectId: null, examCategoryId: null })}
              className="inline-flex h-9 items-center gap-2 self-start rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <FilePlus2 className="h-4 w-4" />
              시험지 만들기
            </button>
          </div>

          {isLoading ? (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              불러오는 중
            </div>
          ) : exams.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">아직 시험지가 없습니다.</p>
              <p className="mt-1 text-xs text-muted-foreground">우측 상단 버튼으로 첫 시험지를 만드세요.</p>
            </div>
          ) : visibleExams.length === 0 ? (
            <div className="flex h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
              <ClipboardList className="h-8 w-8 text-muted-foreground" />
              <p className="mt-3 text-sm font-semibold">이 과목에는 시험지가 없습니다.</p>
              <p className="mt-1 text-xs text-muted-foreground">다른 과목을 선택하거나 전체 보기로 돌아가세요.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {visibleExams.map((exam) => {
              const meta = STATUS_META[exam.status];
              return (
                <div
                  key={exam.id}
                  className="flex flex-col rounded-lg border border-border bg-background p-4"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-xs font-semibold ${meta.tone}`}>
                        {meta.label}
                      </span>
                      <h3 className="truncate text-base font-bold">{exam.title}</h3>
                    </div>
                    {exam.description && (
                      <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">{exam.description}</p>
                    )}
                    <p className="mt-2 text-xs text-muted-foreground">
                      문항 {exam.itemCount}개 · 총점 {exam.totalPoints}점
                      {exam.timeLimitMinutes ? ` · 제한 ${exam.timeLimitMinutes}분` : " · 시간 무제한"}
                    </p>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      {exam.status === "DRAFT" && (
                        <>
                          <ActionButton onClick={() => router.push(`/exams/build?id=${exam.id}`)} icon={Pencil}>
                            문항 편집
                          </ActionButton>
                          <ActionButton
                            primary
                            icon={Send}
                            disabled={exam.itemCount === 0 || publishMutation.isPending}
                            onClick={() => publishMutation.mutate(exam.id)}
                          >
                            발행
                          </ActionButton>
                          <IconButton title="삭제" onClick={() => setConfirmDelete(exam)} danger>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </>
                      )}
                      {exam.status === "PUBLISHED" && (
                        <>
                          <ActionButton primary icon={PlayCircle} onClick={() => router.push(`/exams/take?id=${exam.id}`)}>
                            응시
                          </ActionButton>
                          <ActionButton icon={Lock} disabled={closeMutation.isPending} onClick={() => closeMutation.mutate(exam.id)}>
                            마감
                          </ActionButton>
                          <IconButton title="삭제" onClick={() => setConfirmDelete(exam)} danger>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </>
                      )}
                      {exam.status === "CLOSED" && (
                        <>
                          <span className="text-xs text-muted-foreground">마감된 시험입니다.</span>
                          <IconButton title="삭제" onClick={() => setConfirmDelete(exam)} danger>
                            <Trash2 className="h-3.5 w-3.5" />
                          </IconButton>
                        </>
                      )}
                  </div>
                </div>
              );
            })}
            </div>
          )}
        </section>
      </div>

      {create && (
        <Modal title="시험지 만들기" onClose={() => setCreate(null)}>
          <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-3 p-5">
              <Field label="제목">
                <input
                  autoFocus
                  value={create.title}
                  onChange={(e) => setCreate((c) => (c ? { ...c, title: e.target.value } : c))}
                  placeholder="예: 이차방정식 단원평가"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="설명 (선택)">
                <textarea
                  value={create.description}
                  onChange={(e) => setCreate((c) => (c ? { ...c, description: e.target.value } : c))}
                  rows={4}
                  placeholder="예: 근의 공식, 판별식, 근과 계수 관계를 확인하는 단원 평가"
                  className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <Field label="시험지 분류 (선택)">
                <select
                  value={create.examCategoryId ?? ""}
                  onChange={(e) =>
                    setCreate((c) =>
                      c ? { ...c, examCategoryId: e.target.value ? Number(e.target.value) : null } : c,
                    )
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">미분류</option>
                  {examCategoryOptions.map((category) => (
                    <option key={category.id} value={category.id}>
                      {"　".repeat(category.depth)}
                      {category.pathLabel}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="문제 출제 범위 (선택)">
                <select
                  value={create.subjectId ?? ""}
                  onChange={(e) =>
                    setCreate((c) =>
                      c ? { ...c, subjectId: e.target.value ? Number(e.target.value) : null } : c,
                    )
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  <option value="">전체 문제은행</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="제한 시간(분, 비우면 무제한)">
                <input
                  type="number"
                  min={1}
                  value={create.timeLimit}
                  onChange={(e) => setCreate((c) => (c ? { ...c, timeLimit: e.target.value } : c))}
                  placeholder="무제한"
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </Field>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setCreate(null)}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={!create.title.trim() || createMutation.isPending}
                  onClick={() => create && createMutation.mutate(create)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                  만들고 문항 추가
                </button>
              </div>
            </div>

            <CreateExamExample />
          </div>
        </Modal>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="시험지를 삭제할까요?"
        description={`"${confirmDelete?.title}" 시험지와 학습자의 모든 응시·채점 기록이 함께 삭제됩니다. 되돌릴 수 없습니다.`}
        confirmText="삭제"
        loading={deleteMutation.isPending}
        onConfirm={() => confirmDelete && deleteMutation.mutate(confirmDelete.id)}
        onCancel={() => setConfirmDelete(null)}
      />
    </main>
  );
}

function SubjectSidebar({
  categories,
  total,
  uncategorizedCount,
  selected,
  onSelect,
}: {
  categories: ExamCategoryNode[];
  total: number;
  uncategorizedCount: number;
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <aside className="lg:sticky lg:top-5 lg:self-start">
      <div className="rounded-lg border border-border bg-background p-3">
        <div className="flex items-center gap-2 px-1 pb-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <h2 className="text-sm font-bold">시험지 분류</h2>
        </div>
        <div className="space-y-0.5">
          <SubjectRow label="전체" count={total} active={selected === "all"} onClick={() => onSelect("all")} />
          {categories.map((category) => (
            <ExamCategoryRow
              key={category.id}
              node={category}
              depth={0}
              selected={selected}
              onSelect={onSelect}
            />
          ))}
          {uncategorizedCount > 0 && (
            <SubjectRow
              label="미분류"
              count={uncategorizedCount}
              active={selected === UNCLASSIFIED}
              onClick={() => onSelect(UNCLASSIFIED)}
            />
          )}
        </div>
      </div>
    </aside>
  );
}

function ExamCategoryRow({
  node,
  depth,
  selected,
  onSelect,
}: {
  node: ExamCategoryNode;
  depth: number;
  selected: string;
  onSelect: (key: string) => void;
}) {
  const key = String(node.id);
  return (
    <div>
      <SubjectRow
        label={node.name}
        count={node.subtreeCount}
        active={selected === key}
        onClick={() => onSelect(key)}
        indent={depth}
      />
      {node.children.map((child) => (
        <ExamCategoryRow key={child.id} node={child} depth={depth + 1} selected={selected} onSelect={onSelect} />
      ))}
    </div>
  );
}

function SubjectRow({
  label,
  count,
  active,
  onClick,
  indent = 0,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  indent?: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ paddingLeft: 10 + indent * 14 }}
      className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-sm transition-colors ${
        active ? "bg-primary/10 font-semibold text-primary" : "text-foreground hover:bg-accent"
      }`}
    >
      <span className="truncate">{label}</span>
      <span className={`shrink-0 text-xs ${active ? "text-primary" : "text-muted-foreground"}`}>{count}</span>
    </button>
  );
}

function ActionButton({
  children,
  icon: Icon,
  onClick,
  primary,
  disabled,
}: {
  children: React.ReactNode;
  icon: typeof Pencil;
  onClick: () => void;
  primary?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-sm font-semibold transition-opacity disabled:opacity-50 ${
        primary
          ? "bg-primary text-primary-foreground hover:opacity-90"
          : "border border-border hover:bg-accent"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      {children}
    </button>
  );
}

function IconButton({
  children,
  onClick,
  title,
  danger,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground ${
        danger ? "hover:bg-destructive hover:text-white" : "hover:bg-accent hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-20"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-4xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <h2 className="text-base font-bold tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-semibold">{label}</span>
      {children}
    </label>
  );
}

function CreateExamExample() {
  return (
    <aside className="border-t border-border bg-muted/25 p-5 lg:border-l lg:border-t-0">
      <div className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground">
        <ClipboardList className="h-3.5 w-3.5" />
        예시
      </div>

      <div className="mt-4 rounded-lg border border-border bg-background p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-muted-foreground">시험지 미리보기</p>
            <h3 className="mt-1 text-base font-bold tracking-tight">이차방정식 단원평가</h3>
          </div>
          <span className="shrink-0 rounded-md border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
            작성 중
          </span>
        </div>

        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          근의 공식, 판별식, 근과 계수 관계를 확인하는 10문항 평가
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <ExampleMetric label="문항" value="10개" />
          <ExampleMetric label="총점" value="100점" />
          <ExampleMetric label="제한" value="20분" />
        </div>
      </div>

      <div className="mt-4 space-y-2">
        <ExampleStep index={1} label="시험지 생성" active />
        <ExampleStep index={2} label="문제 은행에서 문항 추가" />
        <ExampleStep index={3} label="발행 후 학습자 응시" />
      </div>
    </aside>
  );
}

function ExampleMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-muted/30 px-2 py-2">
      <p className="text-[11px] font-semibold text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-bold">{value}</p>
    </div>
  );
}

function ExampleStep({
  index,
  label,
  active,
}: {
  index: number;
  label: string;
  active?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2">
      <span
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
        }`}
      >
        {index}
      </span>
      <span className="text-sm font-semibold">{label}</span>
    </div>
  );
}
