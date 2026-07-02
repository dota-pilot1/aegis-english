"use client";

import { FormEvent, MouseEvent as ReactMouseEvent, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  FileText,
  Filter,
  FolderPlus,
  FolderTree,
  Play,
  LayoutGrid,
  Layers,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  Square,
  Table2,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import { SearchInput } from "@/shared/ui/SearchInput";
import { SelectField } from "@/shared/ui/SelectField";
import { agentChatApi } from "@/entities/agent/api/agentChatApi";
import {
  buildCategoryTree,
  categoryApi,
  flattenCategoryTree,
  type CategoryNode,
} from "@/entities/category/api/categoryApi";
import {
  questionApi,
  type EmbeddingStatus,
  type QuestionDifficulty,
  type QuestionListParams,
  type QuestionResponse,
  type QuestionType,
  type QuestionUpsertRequest,
  type SimilarQuestion,
} from "@/entities/question/api/questionApi";
import { toast, toastError } from "@/shared/lib/toast";
import { useConfirm } from "@/shared/ui/useConfirm";
import { CategoryPickerDialog } from "./CategoryPickerDialog";
import { QuestionGrid } from "./QuestionGrid";

type ViewMode = "card" | "grid";

type ReadingQuestionTemplate = {
  id: string;
  title: string;
  subtype: string;
  difficulty: QuestionDifficulty;
  question: string;
  passage?: string;
  choices: string[];
  answer: string;
  explanation: string;
  keywords: string[];
  categoryHint: string;
  rules: string[];
};

type SimilarGenerationOptions = {
  count: number;
  difficulty: QuestionDifficulty | "source";
  choiceCount: number;
  includeExplanation: boolean;
  keepTopic: boolean;
  avoidDuplicate: boolean;
};

type GeneratedReadingDraft = {
  id: string;
  label: string;
  body: QuestionUpsertRequest;
};

const difficulties: { value: QuestionDifficulty; label: string }[] = [
  { value: "easy", label: "하" },
  { value: "medium", label: "중" },
  { value: "hard", label: "상" },
];

const initialForm: QuestionUpsertRequest = {
  questionType: "MULTIPLE_CHOICE",
  categoryId: null,
  difficulty: "medium",
  question: "",
  passage: "",
  choices: [],
  answer: "",
  explanation: "",
  keywords: [],
  embeddingText: "",
};

const initialChoiceRows = ["", "", "", ""];

const readingCategoryHints = ["읽기", "내용일치", "문장해석", "어휘추론", "빈칸", "독해"];

const splitReadingQuestion = (question: QuestionResponse | QuestionUpsertRequest | ReadingQuestionTemplate) => {
  const text = question.question.trim();
  const separatedPassage = "passage" in question ? (question.passage ?? "").trim() : "";
  const categoryPath = "categoryPath" in question ? question.categoryPath : [];
  const categoryHint = "categoryHint" in question ? question.categoryHint : "";
  const isReadingLike = [...categoryPath, categoryHint].some((part) =>
    readingCategoryHints.some((hint) => part.includes(hint)),
  );

  if (!isReadingLike) {
    return { prompt: text, passage: separatedPassage };
  }

  if (separatedPassage) {
    return { prompt: text, passage: separatedPassage };
  }

  const doubleNewlineIndex = text.indexOf("\n\n");
  if (doubleNewlineIndex > -1) {
    return {
      prompt: text.slice(0, doubleNewlineIndex).trim(),
      passage: text.slice(doubleNewlineIndex).trim(),
    };
  }

  const promptBoundary = text.match(/[?？]\s+(?=[A-Z])/);
  if (promptBoundary?.index != null) {
    const splitIndex = promptBoundary.index + 1;
    return {
      prompt: text.slice(0, splitIndex).trim(),
      passage: text.slice(splitIndex).trim(),
    };
  }

  return { prompt: text, passage: "" };
};

const readingQuestionTemplates: ReadingQuestionTemplate[] = [
  {
    id: "reading-main-idea",
    title: "주제 고르기",
    subtype: "내용일치",
    difficulty: "medium",
    question: "다음 글의 주제로 가장 알맞은 것은?",
    passage:
      "Many students try to memorize many English words at once before a test. However, they often forget most of them a few days later. A better way is to review a small number of words every day. Short daily practice gives the brain more chances to meet the same words again. Over time, this habit helps students remember new vocabulary for a long time.",
    choices: ["매일 복습의 효과", "학교 시설의 중요성", "여행 계획 세우기", "운동 경기의 규칙"],
    answer: "매일 복습의 효과",
    explanation: "글은 많은 단어를 한 번에 외우는 것보다 매일 조금씩 복습하는 습관이 장기 기억에 도움이 된다는 내용입니다.",
    keywords: ["영어", "독해", "주제", "review", "practice"],
    categoryHint: "내용일치",
    rules: ["지문은 4~5문장", "선지는 한국어 명사구 4개", "정답은 글 전체의 핵심 효과", "오답은 소재만 비슷한 일반 주제"],
  },
  {
    id: "reading-title",
    title: "제목 고르기",
    subtype: "내용일치",
    difficulty: "medium",
    question: "다음 글의 제목으로 가장 알맞은 것은?",
    passage:
      "A library is not only a place where people borrow books. Many libraries now offer quiet rooms for study and small spaces for group projects. Some libraries also run reading clubs or language programs for students. People can meet others who have similar interests and learn together. In this way, a library can become an active learning place for the whole community.",
    choices: ["A Library as a Learning Place", "How to Buy New Books", "The History of Sports", "A Trip to the Sea"],
    answer: "A Library as a Learning Place",
    explanation: "글은 도서관이 책을 빌리는 곳을 넘어 공부, 모임, 학습 프로그램을 제공하는 공간이라는 내용입니다.",
    keywords: ["영어", "독해", "제목", "library", "learning"],
    categoryHint: "내용일치",
    rules: ["지문은 4~5문장", "선지는 영어 제목 4개", "정답은 전체 내용을 포괄", "오답은 범위가 너무 좁거나 무관한 제목"],
  },
  {
    id: "reading-detail",
    title: "내용 일치",
    subtype: "내용일치",
    difficulty: "easy",
    question: "다음 글의 내용과 일치하는 것은?",
    passage:
      "Mina takes the bus to school every morning. The bus stop is about five minutes from her house. On rainy days, she leaves home ten minutes earlier because the bus is often crowded. She usually reads a short English story while she waits. This small habit helps her use waiting time well.",
    choices: ["Mina walks to school.", "Mina takes the bus to school.", "Mina leaves later on rainy days.", "Mina goes to school at night."],
    answer: "Mina takes the bus to school.",
    explanation: "본문 첫 문장에서 Mina가 매일 아침 버스를 타고 학교에 간다고 했습니다.",
    keywords: ["영어", "독해", "내용일치", "bus", "school"],
    categoryHint: "내용일치",
    rules: ["지문은 사실 관계 4~5문장", "정답은 본문 문장과 직접 일치", "오답은 이동수단·시간·조건을 하나씩 왜곡", "선지는 영어 문장 4개"],
  },
  {
    id: "reading-blank",
    title: "빈칸 추론",
    subtype: "문장해석",
    difficulty: "hard",
    question: "빈칸에 들어갈 말로 가장 알맞은 것은?",
    passage:
      "Jisu wanted to play a difficult song for the school concert. At first, she made many mistakes and felt nervous. Instead of giving up, she practiced the song for thirty minutes every day. Her teacher also gave her simple advice about rhythm. As a result, she became much ____ at playing it.",
    choices: ["better", "colder", "heavier", "slower"],
    answer: "better",
    explanation: "꾸준히 연습하고 조언을 받은 결과 연주 실력이 더 좋아졌다는 흐름이므로 better가 알맞습니다.",
    keywords: ["영어", "독해", "빈칸", "practice", "better"],
    categoryHint: "문장해석",
    rules: ["지문은 원인-결과 구조 4~5문장", "빈칸은 결과를 완성하는 형용사/부사", "정답은 문맥상 긍정·부정 방향이 유일", "오답은 품사는 맞지만 의미 흐름이 어긋남"],
  },
  {
    id: "reading-reference",
    title: "지시어 의미 파악",
    subtype: "문장해석",
    difficulty: "medium",
    question: '다음 글에서 "it"이 가리키는 것은?',
    passage:
      "Sora bought a new dictionary for her English class. The book includes simple meanings, example sentences, and pronunciation tips. When she studies new words at home, she keeps it on her desk. She checks it before writing her own example sentences. This helps her understand how each word is used.",
    choices: ["a dictionary", "Sora", "English words", "a store"],
    answer: "a dictionary",
    explanation: "세 번째와 네 번째 문장의 it은 앞에서 언급된 a new dictionary를 가리킵니다.",
    keywords: ["영어", "독해", "지시어", "dictionary"],
    categoryHint: "문장해석",
    rules: ["지문은 선행사와 대명사를 포함한 4~5문장", "문항은 지시어가 가리키는 대상을 질문", "정답은 명시된 선행사", "오답은 주변 명사·인물·장소"],
  },
];

const questionTypeLabel = (value: QuestionType) =>
  value === "MULTIPLE_CHOICE" ? "객관식" : "주관식";

const isListeningQuestion = (question: QuestionResponse) =>
  question.listening || question.area === "듣기" || question.categoryPath.some((part) => part.includes("듣기"));

const difficultyLabel = (value: QuestionDifficulty) =>
  difficulties.find((difficulty) => difficulty.value === value)?.label ?? value;

const splitQuestionPrompt = (question: string) => {
  const [prompt, ...passageParts] = question.split(/\n\s*\n/);
  return {
    prompt: prompt?.trim() ?? "",
    passage: passageParts.join("\n\n").trim(),
  };
};

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

const buildEmbeddingTextPreview = (
  form: QuestionUpsertRequest,
  keywordsText: string,
  answer: string,
  categoryPathLabel: string,
) => {
  const keywords = splitCsv(keywordsText);
  return [
    `분류: ${categoryPathLabel}`,
    `난이도: ${difficultyLabel(form.difficulty)}`,
    `문제: ${form.question}`,
    `지문: ${form.passage ?? ""}`,
    `정답: ${answer}`,
    `해설: ${form.explanation}`,
    `키워드: ${keywords.join(", ")}`,
  ].join("\n");
};

export function QuestionBankWorkspace({ subjectId }: { subjectId: number }) {
  const qc = useQueryClient();
  const { confirm, confirmDialog } = useConfirm();
  const [filters, setFilters] = useState<QuestionListParams>({});
  const [viewMode, setViewMode] = useState<ViewMode>("card");
  const [selected, setSelected] = useState<QuestionResponse[]>([]);
  const [form, setForm] = useState<QuestionUpsertRequest>(initialForm);
  const [choiceRows, setChoiceRows] = useState<string[]>(initialChoiceRows);
  const [answerIndex, setAnswerIndex] = useState<number | null>(null);
  const [shortAnswer, setShortAnswer] = useState("");
  const [keywordsText, setKeywordsText] = useState(initialForm.keywords?.join(", ") ?? "");
  const [formOpen, setFormOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [templateSource, setTemplateSource] = useState<QuestionResponse | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [embedTarget, setEmbedTarget] = useState<QuestionResponse | null>(null);
  const [similarTarget, setSimilarTarget] = useState<QuestionResponse | null>(null);
  const [listeningTarget, setListeningTarget] = useState<QuestionResponse | null>(null);

  const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
    queryKey: ["question-categories"],
    queryFn: categoryApi.list,
  });

  const fullTree = useMemo(() => buildCategoryTree(categories), [categories]);
  const subject = useMemo(
    () => fullTree.find((root) => root.id === subjectId) ?? null,
    [fullTree, subjectId],
  );
  const pickerRoots = useMemo(() => (subject ? [subject] : []), [subject]);
  const categoryOptions = useMemo(() => flattenCategoryTree(pickerRoots), [pickerRoots]);

  const effectiveCategoryId = filters.categoryId ?? subjectId;

  const { data = [], isLoading, isFetching } = useQuery({
    queryKey: ["questions", subjectId, filters],
    queryFn: () => questionApi.list({ ...filters, categoryId: effectiveCategoryId }),
    enabled: !!subject,
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["questions"] });
    qc.invalidateQueries({ queryKey: ["question-categories"] });
  };

  const createCategoryMutation = useMutation({
    mutationFn: categoryApi.create,
    onSuccess: () => {
      toast.success("분류를 추가했습니다.");
      qc.invalidateQueries({ queryKey: ["question-categories"] });
    },
    onError: (e) => toastError(e, "분류 추가에 실패했습니다."),
  });

  const renameCategoryMutation = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => categoryApi.rename(id, name),
    onSuccess: () => {
      toast.success("분류 이름을 변경했습니다.");
      invalidateAll();
    },
    onError: (e) => toastError(e, "이름 변경에 실패했습니다."),
  });

  const deleteCategoryMutation = useMutation({
    mutationFn: categoryApi.delete,
    onSuccess: () => {
      toast.success("분류를 삭제했습니다.");
      setFilters((cur) => ({ ...cur, categoryId: undefined }));
      qc.invalidateQueries({ queryKey: ["question-categories"] });
    },
    onError: (e) => toastError(e, "분류 삭제에 실패했습니다."),
  });

  const resetFormState = () => {
    setForm(initialForm);
    setChoiceRows(initialChoiceRows);
    setAnswerIndex(null);
    setShortAnswer("");
    setKeywordsText(initialForm.keywords?.join(", ") ?? "");
    setEditingId(null);
    setPickerOpen(false);
  };

  const createMutation = useMutation({
    mutationFn: questionApi.create,
    onSuccess: () => {
      toast.success("문제를 저장했습니다.");
      invalidateAll();
      resetFormState();
      setFormOpen(false);
    },
    onError: (e) => toastError(e, "문제 저장에 실패했습니다."),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, body }: { id: string; body: QuestionUpsertRequest }) => questionApi.update(id, body),
    onSuccess: () => {
      toast.success("문제를 수정했습니다.");
      invalidateAll();
      resetFormState();
      setFormOpen(false);
    },
    onError: (e) => toastError(e, "문제 수정에 실패했습니다."),
  });

  const deleteMutation = useMutation({
    mutationFn: questionApi.delete,
    onSuccess: () => {
      toast.success("문제를 삭제했습니다.");
      invalidateAll();
    },
    onError: (e) => toastError(e, "문제 삭제에 실패했습니다."),
  });

  const bulkDeleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => questionApi.delete(id))),
    onSuccess: (_res, ids) => {
      toast.success(`${ids.length}건을 삭제했습니다.`);
      setSelected([]);
      invalidateAll();
    },
    onError: (e) => toastError(e, "일괄 삭제에 실패했습니다."),
  });

  const bulkEmbedMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map((id) => questionApi.embedOne(id))),
    onSuccess: (results) => {
      const completed = results.filter((q) => q.embeddingStatus === "COMPLETED").length;
      const failed = results.filter((q) => q.embeddingStatus === "FAILED").length;
      toast.success(`임베딩 ${completed}건 완료${failed > 0 ? `, ${failed}건 실패` : ""}`);
      setSelected([]);
      qc.invalidateQueries({ queryKey: ["questions"] });
    },
    onError: (e) => toastError(e, "일괄 임베딩에 실패했습니다."),
  });

  const handleBulkDelete = async () => {
    const ids = selected.map((q) => q.id);
    if (ids.length === 0) return;
    if (
      await confirm({
        title: "선택 문제 삭제",
        description: `선택한 ${ids.length}건을 삭제할까요?`,
        confirmText: "삭제",
        variant: "destructive",
      })
    ) {
      bulkDeleteMutation.mutate(ids);
    }
  };

  const handleBulkEmbed = async () => {
    const ids = selected.map((q) => q.id);
    if (ids.length === 0) return;
    if (
      await confirm({
        title: "선택 문제 임베딩",
        description: `선택한 ${ids.length}건을 OpenAI로 임베딩 벡터 변환할까요?`,
        confirmText: "임베딩 진행",
      })
    ) {
      bulkEmbedMutation.mutate(ids);
    }
  };

  const { data: similarList = [], isFetching: isFetchingSimilar } = useQuery({
    queryKey: ["questions", "similar", similarTarget?.id],
    queryFn: () => questionApi.findSimilar(similarTarget!.id, 3),
    enabled: !!similarTarget,
  });

  const embedOneMutation = useMutation({
    mutationFn: (id: string) => questionApi.embedOne(id),
    onSuccess: (updated) => {
      if (updated.embeddingStatus === "COMPLETED") {
        toast.success("임베딩 변환이 완료됐습니다.");
      } else if (updated.embeddingStatus === "FAILED") {
        toastError(new Error("OpenAI 호출 실패"), "임베딩 변환에 실패했습니다.");
      }
      qc.invalidateQueries({ queryKey: ["questions"] });
      setEmbedTarget(null);
    },
    onError: (e) => {
      toastError(e, "임베딩 변환 요청에 실패했습니다.");
      setEmbedTarget(null);
    },
  });

  const { data: embeddingCounts } = useQuery({
    queryKey: ["questions", "embedding-status", subjectId],
    queryFn: () => questionApi.embeddingStatus(subjectId),
    refetchInterval: 30000,
  });
  const pendingCount = (embeddingCounts?.pending ?? 0) + (embeddingCounts?.failed ?? 0);

  const embedBatchMutation = useMutation({
    mutationFn: () => questionApi.embedPending(50, subjectId),
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
    },
    onError: (e) => toastError(e, "임베딩 배치에 실패했습니다."),
  });

  const handleEmbedBatch = async () => {
    if (
      await confirm({
        title: `${subject?.name ?? "이 과목"} 문제를 일괄 임베딩할까요?`,
        description: `${subject?.name ?? "이 과목"}의 임베딩 대기·실패 상태 문제를 OpenAI로 한 번에 변환합니다. (한 번에 최대 50건)`,
        confirmText: "임베딩 진행",
      })
    ) {
      embedBatchMutation.mutate();
    }
  };

  const isMultipleChoice = form.questionType === "MULTIPLE_CHOICE";

  const effectiveAnswer = isMultipleChoice
    ? (answerIndex !== null ? (choiceRows[answerIndex]?.trim() ?? "") : "")
    : shortAnswer.trim();

  const selectedCategoryLabel =
    categoryOptions.find((option) => option.id === form.categoryId)?.pathLabel ?? "";

  const openTemplateDialog = (source: QuestionResponse | null = null) => {
    setTemplateSource(source);
    setTemplateOpen(true);
  };

  const closeTemplateDialog = () => {
    setTemplateOpen(false);
    setTemplateSource(null);
  };

  const handleChangeChoice = (index: number, value: string) => {
    setChoiceRows((rows) => rows.map((row, i) => (i === index ? value : row)));
  };

  const handleAddChoice = () => setChoiceRows((rows) => [...rows, ""]);

  const handleRemoveChoice = (index: number) => {
    setChoiceRows((rows) => rows.filter((_, i) => i !== index));
    setAnswerIndex((cur) => {
      if (cur === null) return null;
      if (cur === index) return null;
      return cur > index ? cur - 1 : cur;
    });
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (form.categoryId === null) {
      toast.error("카테고리를 선택해 주세요.");
      return;
    }
    let choices: string[] = [];
    if (isMultipleChoice) {
      choices = choiceRows.map((row) => row.trim()).filter(Boolean);
      if (choices.length < 2) {
        toast.error("객관식 보기를 2개 이상 입력해 주세요.");
        return;
      }
      if (!effectiveAnswer) {
        toast.error("정답 보기를 선택해 주세요.");
        return;
      }
    }
    const body: QuestionUpsertRequest = {
      ...form,
      choices,
      answer: effectiveAnswer,
      keywords: splitCsv(keywordsText),
      embeddingText: undefined,
    };
    if (editingId) {
      updateMutation.mutate({ id: editingId, body });
    } else {
      createMutation.mutate(body);
    }
  };

  const handleUseDraft = (draft: QuestionUpsertRequest) => {
    const choices = draft.choices && draft.choices.length > 0 ? draft.choices : initialChoiceRows;
    const answerIndex = choices.findIndex((choice) => choice === draft.answer);

    setForm(draft);
    setChoiceRows(choices);
    setAnswerIndex(answerIndex >= 0 ? answerIndex : null);
    setShortAnswer("");
    setKeywordsText(draft.keywords?.join(", ") ?? "");
    setEditingId(null);
    closeTemplateDialog();
    setFormOpen(true);
  };

  const handleEdit = (question: QuestionResponse) => {
    const questionType: QuestionType =
      question.questionType ?? (question.choices.length > 0 ? "MULTIPLE_CHOICE" : "SHORT_ANSWER");
    setForm({
      questionType,
      categoryId: question.categoryId,
      difficulty: question.difficulty,
      question: question.question,
      passage: question.passage ?? "",
      choices: question.choices,
      answer: question.answer,
      explanation: question.explanation,
      keywords: question.keywords,
      embeddingText: "",
    });
    if (questionType === "MULTIPLE_CHOICE") {
      setChoiceRows(question.choices.length > 0 ? question.choices : initialChoiceRows);
      const idx = question.choices.indexOf(question.answer);
      setAnswerIndex(idx >= 0 ? idx : null);
      setShortAnswer("");
    } else {
      setChoiceRows(initialChoiceRows);
      setAnswerIndex(null);
      setShortAnswer(question.answer);
    }
    setKeywordsText(question.keywords.join(", "));
    setEditingId(question.id);
    setFormOpen(true);
  };

  const handleCloseForm = () => {
    setFormOpen(false);
    resetFormState();
  };

  const embeddingTextPreview = useMemo(
    () => buildEmbeddingTextPreview(form, keywordsText, effectiveAnswer, selectedCategoryLabel),
    [form, keywordsText, effectiveAnswer, selectedCategoryLabel],
  );
  const generationCategoryId = filters.categoryId ?? subjectId;
  const generationCategoryPath =
    categoryOptions.find((option) => option.id === generationCategoryId)?.pathLabel ?? subject?.name ?? "";

  if (!isLoadingCategories && !subject) {
    return (
      <main className="flex min-h-[calc(100vh-3.5rem)] items-center justify-center bg-muted/25 px-4">
        <div className="rounded-lg border border-dashed border-border bg-background px-10 py-12 text-center">
          <CircleAlert className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 text-sm font-semibold">과목을 찾을 수 없습니다.</p>
          <Link
            href="/question-bank"
            className="mt-4 inline-flex h-9 items-center gap-1.5 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            과목 목록으로
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto w-full max-w-[1600px] space-y-5">
        <section className="flex flex-col gap-4 border-b border-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <Link
              href="/question-bank"
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              과목 목록
            </Link>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">{subject?.name ?? ""} 문제 은행</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {subject?.name ?? "과목"} 분류 트리에 문제를 등록하고 관리합니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm">
              <span className="font-semibold text-muted-foreground">전체 문제</span>
              <span className="font-bold tabular-nums">{subject?.subtreeCount ?? 0}</span>
            </div>
            <button
              type="button"
              onClick={handleEmbedBatch}
              disabled={embedBatchMutation.isPending || pendingCount === 0}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent disabled:opacity-50"
              title={pendingCount === 0 ? "임베딩 대기 중인 문제가 없습니다." : "대기·실패 문제를 일괄 임베딩"}
            >
              {embedBatchMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              임베딩 대기
              <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-bold tabular-nums text-muted-foreground">
                {pendingCount}
              </span>
            </button>
            <button
              type="button"
              onClick={() => openTemplateDialog()}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
            >
              <FileText className="h-4 w-4" />
              템플릿 보기
            </button>
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              문제 등록
            </button>
          </div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[260px_minmax(0,1fr)]">
          <CategoryTree
            roots={subject?.children ?? []}
            totalCount={subject?.subtreeCount ?? 0}
            selectedId={filters.categoryId}
            onSelect={(categoryId) => setFilters((cur) => ({ ...cur, categoryId }))}
            onCreate={(parentId, name) => createCategoryMutation.mutate({ parentId: parentId ?? subjectId, name })}
            onRename={(id, name) => renameCategoryMutation.mutate({ id, name })}
            onDelete={(id) => deleteCategoryMutation.mutate(id)}
          />

          <QuestionTemplateDialog
            open={templateOpen}
            source={templateSource}
            fallbackCategoryId={generationCategoryId}
            fallbackCategoryPath={generationCategoryPath}
            templates={readingQuestionTemplates}
            onUseDraft={handleUseDraft}
            onClose={closeTemplateDialog}
          />

          {formOpen && (
          <div
            className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
            onClick={(e) => {
              if (e.target === e.currentTarget) handleCloseForm();
            }}
          >
          <form onSubmit={handleSubmit} className="w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
              <div>
                <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Question</p>
                <h2 className="mt-1 text-lg font-bold tracking-tight">
                  {editingId ? "문제 수정" : "문제 등록"}
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">embeddingText는 우측 미리보기 그대로 서버가 저장합니다.</p>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
                aria-label="닫기"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
              <section className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5 text-sm font-semibold">
                    <span>카테고리</span>
                    <button
                      type="button"
                      onClick={() => setPickerOpen(true)}
                      className="flex h-10 w-full items-center justify-between gap-2 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      title="카테고리 선택"
                    >
                      <span className={`truncate font-medium ${form.categoryId === null ? "text-muted-foreground" : ""}`}>
                        {selectedCategoryLabel || "카테고리 선택"}
                      </span>
                      <FolderTree className="h-4 w-4 shrink-0 text-muted-foreground" />
                    </button>
                  </div>
                  <SelectField
                    label="난이도"
                    value={form.difficulty}
                    onChange={(e) => setForm((cur) => ({ ...cur, difficulty: e.target.value as QuestionDifficulty }))}
                    options={difficulties.map((difficulty) => ({ value: difficulty.value, label: difficulty.label }))}
                  />
                </div>

                <TextArea
                  label="문제"
                  rows={3}
                  value={form.question}
                  onChange={(value) => setForm((cur) => ({ ...cur, question: value }))}
                />
                <TextArea
                  label="지문"
                  rows={5}
                  value={form.passage ?? ""}
                  onChange={(value) => setForm((cur) => ({ ...cur, passage: value }))}
                />
                <div className="space-y-3 rounded-lg border border-border p-3">
                  <div className="grid grid-cols-2 gap-1 rounded-md bg-muted p-1" role="tablist">
                    {(["MULTIPLE_CHOICE", "SHORT_ANSWER"] as const).map((type) => (
                      <button
                        key={type}
                        type="button"
                        role="tab"
                        aria-selected={form.questionType === type}
                        onClick={() => setForm((cur) => ({ ...cur, questionType: type }))}
                        className={`h-9 rounded-md text-sm font-semibold transition-colors ${
                          form.questionType === type
                            ? "bg-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                      >
                        {questionTypeLabel(type)}
                      </button>
                    ))}
                  </div>

                  {isMultipleChoice ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">보기 · 정답 선택</span>
                        <span className="text-xs text-muted-foreground">라디오 버튼으로 정답을 지정하세요.</span>
                      </div>
                      {choiceRows.map((row, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="answer-choice"
                            checked={answerIndex === index}
                            onChange={() => setAnswerIndex(index)}
                            disabled={!row.trim()}
                            className="h-4 w-4 shrink-0 accent-primary disabled:cursor-not-allowed"
                            aria-label={`보기 ${index + 1} 정답으로 선택`}
                            title={row.trim() ? "정답으로 선택" : "보기를 먼저 입력하세요"}
                          />
                          <input
                            value={row}
                            onChange={(e) => handleChangeChoice(index, e.target.value)}
                            placeholder={`보기 ${index + 1}`}
                            className={`h-10 w-full rounded-md border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring ${
                              answerIndex === index ? "border-emerald-400 bg-emerald-50/50" : "border-input"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveChoice(index)}
                            disabled={choiceRows.length <= 2}
                            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-40"
                            aria-label={`보기 ${index + 1} 삭제`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={handleAddChoice}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-sm font-semibold text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Plus className="h-4 w-4" />
                        보기 추가
                      </button>
                    </div>
                  ) : (
                    <TextField
                      label="정답"
                      value={shortAnswer}
                      onChange={setShortAnswer}
                      placeholder="정답을 직접 입력"
                    />
                  )}
                </div>
                <TextArea
                  label="해설"
                  rows={3}
                  value={form.explanation}
                  onChange={(value) => setForm((cur) => ({ ...cur, explanation: value }))}
                />
                <TextField label="키워드" value={keywordsText} onChange={setKeywordsText} placeholder="쉼표로 구분" />
              </section>

              <section className="flex min-h-[520px] flex-col rounded-lg border border-border bg-muted/20">
                <div className="border-b border-border px-4 py-3">
                  <h3 className="text-sm font-bold">embeddingText 미리보기</h3>
                  <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                    왼쪽 필드를 기반으로 서버가 자동 생성할 검색용 텍스트입니다. 직접 수정할 수 없습니다.
                  </p>
                </div>
                <pre className="min-h-0 flex-1 overflow-auto whitespace-pre-wrap px-4 py-3 font-mono text-xs leading-6 text-foreground">
                  {embeddingTextPreview}
                </pre>
              </section>

              <div className="mt-1 flex justify-end gap-2 border-t border-border pt-4 lg:col-span-2">
                <button
                  type="button"
                  onClick={handleCloseForm}
                  className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
                >
                  {createMutation.isPending || updateMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : editingId ? (
                    <Pencil className="h-4 w-4" />
                  ) : (
                    <Plus className="h-4 w-4" />
                  )}
                  {editingId ? "수정 저장" : "저장"}
                </button>
              </div>
            </div>
          </form>
          </div>
          )}

          <section className="min-w-0 overflow-hidden rounded-lg border border-border bg-background">
            <div className="border-b border-question-border bg-question-surface px-4 py-3">
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-[140px_1.4fr_auto] lg:items-center">
                  <SelectField
                    size="sm"
                    value={filters.difficulty ?? ""}
                    onChange={(e) => setFilters((cur) => ({ ...cur, difficulty: e.target.value as QuestionDifficulty | "" }))}
                    options={difficulties.map((difficulty) => ({ value: difficulty.value, label: difficulty.label }))}
                    placeholder="전체 난이도"
                  />
                  <SearchInput
                    value={filters.keyword ?? ""}
                    onChange={(value) => setFilters((cur) => ({ ...cur, keyword: value }))}
                    placeholder="문제/해설 검색"
                  />
                  <div className="flex items-center justify-end gap-2">
                    <div className="inline-flex h-9 items-center rounded-md border border-border bg-muted/40 p-0.5">
                      <button
                        type="button"
                        onClick={() => {
                          setViewMode("card");
                          setSelected([]);
                        }}
                        aria-pressed={viewMode === "card"}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-sm font-semibold transition-colors ${
                          viewMode === "card"
                            ? "bg-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="카드 보기"
                      >
                        <LayoutGrid className="h-4 w-4" />
                        카드
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode("grid")}
                        aria-pressed={viewMode === "grid"}
                        className={`inline-flex h-8 items-center gap-1.5 rounded-[5px] px-2.5 text-sm font-semibold transition-colors ${
                          viewMode === "grid"
                            ? "bg-background shadow-sm"
                            : "text-muted-foreground hover:text-foreground"
                        }`}
                        title="그리드 보기"
                      >
                        <Table2 className="h-4 w-4" />
                        그리드
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFilters({})}
                      className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-accent"
                    >
                      <RefreshCw className="h-4 w-4" />
                      필터 초기화
                    </button>
                  </div>
              </div>
            </div>

            <div className="min-h-[560px] p-4">
              {isLoading ? (
                <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  불러오는 중
                </div>
              ) : data.length === 0 ? (
                <div className="flex h-64 flex-col items-center justify-center rounded-lg border border-dashed border-border text-center">
                  <Filter className="h-8 w-8 text-muted-foreground" />
                  <p className="mt-3 text-sm font-semibold">조건에 맞는 문제가 없습니다.</p>
                </div>
              ) : viewMode === "grid" ? (
                <div className="space-y-3">
                  <div className="flex h-9 items-center justify-between">
                    {isFetching ? (
                      <span className="text-xs font-medium text-muted-foreground">목록을 갱신하는 중입니다.</span>
                    ) : (
                      <span className="text-xs font-medium text-muted-foreground">
                        {selected.length > 0 ? `${selected.length}건 선택됨` : "행을 선택해 일괄 작업할 수 있습니다."}
                      </span>
                    )}
                    {selected.length > 0 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={handleBulkEmbed}
                          disabled={bulkEmbedMutation.isPending || bulkDeleteMutation.isPending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-semibold hover:bg-accent disabled:opacity-50"
                        >
                          {bulkEmbedMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Sparkles className="h-3.5 w-3.5" />
                          )}
                          선택 임베딩
                        </button>
                        <button
                          type="button"
                          onClick={handleBulkDelete}
                          disabled={bulkEmbedMutation.isPending || bulkDeleteMutation.isPending}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-sm font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50"
                        >
                          {bulkDeleteMutation.isPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          선택 삭제
                        </button>
                      </div>
                    )}
                  </div>
                  <QuestionGrid
                    rows={data}
                    onEdit={handleEdit}
                    onEmbed={setEmbedTarget}
                    onShowSimilar={setSimilarTarget}
                    onGenerateSimilar={openTemplateDialog}
                    onSelectionChange={setSelected}
                    onDelete={async (question) => {
                      if (await confirm({
                        title: "문제 삭제",
                        description: "이 문제를 삭제할까요?",
                        confirmText: "삭제",
                        variant: "destructive",
                      })) {
                        deleteMutation.mutate(question.id);
                      }
                    }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {isFetching && (
                    <div className="text-xs font-medium text-muted-foreground">목록을 갱신하는 중입니다.</div>
                  )}
                  {data.map((question) => (
                    <QuestionItem
                      key={question.id}
                      question={question}
                      onEdit={() => handleEdit(question)}
                      onEmbed={() => setEmbedTarget(question)}
                      onListen={() => setListeningTarget(question)}
                      onShowSimilar={() => setSimilarTarget(question)}
                      onGenerateSimilar={() => openTemplateDialog(question)}
                      onDelete={async () => {
                        if (await confirm({
                          title: "문제 삭제",
                          description: "이 문제를 삭제할까요?",
                          confirmText: "삭제",
                          variant: "destructive",
                        })) {
                          deleteMutation.mutate(question.id);
                        }
                      }}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>
        </section>
      </div>

      <CategoryPickerDialog
        open={pickerOpen}
        roots={pickerRoots}
        selectedId={form.categoryId}
        onConfirm={(node) => {
          setForm((cur) => ({ ...cur, categoryId: node.id }));
          setPickerOpen(false);
        }}
        onClose={() => setPickerOpen(false)}
      />

      <SingleEmbedDialog
        target={embedTarget}
        loading={embedOneMutation.isPending}
        onConfirm={() => embedTarget && embedOneMutation.mutate(embedTarget.id)}
        onCancel={() => setEmbedTarget(null)}
      />

      <SimilarQuestionsDialog
        source={similarTarget}
        results={similarList}
        loading={isFetchingSimilar}
        onClose={() => setSimilarTarget(null)}
      />
      <ListeningDialog
        question={listeningTarget}
        onClose={() => setListeningTarget(null)}
      />
      {confirmDialog}
    </main>
  );
}

function QuestionTemplateDialog({
  open,
  source,
  fallbackCategoryId,
  fallbackCategoryPath,
  templates,
  onUseDraft,
  onClose,
}: {
  open: boolean;
  source: QuestionResponse | null;
  fallbackCategoryId: number;
  fallbackCategoryPath: string;
  templates: ReadingQuestionTemplate[];
  onUseDraft: (draft: QuestionUpsertRequest) => void;
  onClose: () => void;
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [options, setOptions] = useState<SimilarGenerationOptions>({
    count: 3,
    difficulty: "source",
    choiceCount: 4,
    includeExplanation: true,
    keepTopic: true,
    avoidDuplicate: true,
  });
  const [generated, setGenerated] = useState<GeneratedReadingDraft[]>([]);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!selectedTemplate) return [];
      const baseRequest = {
        templateId: selectedTemplate.id,
        templateTitle: selectedTemplate.title,
        subtype: selectedTemplate.subtype,
        rules: selectedTemplate.rules,
        ...options,
      };
      if (source) {
        return questionApi.generateSimilarReading(source.id, baseRequest);
      }
      return questionApi.generateSimilarReadingFromTemplate({
        ...baseRequest,
        categoryId: fallbackCategoryId,
        categoryPath: fallbackCategoryPath,
        sourceDifficulty: selectedTemplate.difficulty,
        sourceQuestion: selectedTemplate.question,
        sourcePassage: selectedTemplate.passage ?? "",
        sourceChoices: selectedTemplate.choices,
        sourceAnswer: selectedTemplate.answer,
        sourceExplanation: selectedTemplate.explanation,
        sourceKeywords: selectedTemplate.keywords,
      });
    },
    onSuccess: (drafts) => {
      setGenerated(
        drafts.map((draft, index) => ({
          id: `${Date.now()}-${index}`,
          label: `생성 ${index + 1}`,
          body: draft,
        })),
      );
      if (drafts.length > 0) {
        toast.success(`유사 문제 ${drafts.length}건을 생성했습니다.`);
      }
    },
    onError: (e) => toastError(e, "유사 문제 생성에 실패했습니다."),
  });

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-[1480px] overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Templates</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">
              {source ? "독해 유사 문제 출제" : "독해 문제 템플릿"}
            </h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              기준 문제의 카테고리·난이도는 유지하고, 독해 유형별 규격에 맞춘 새 문제 초안을 만듭니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid min-h-[640px] lg:grid-cols-[580px_minmax(0,1fr)]">
          <aside className="max-h-[calc(100vh-190px)] overflow-y-auto border-b border-border p-5 lg:border-b-0 lg:border-r">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">독해 템플릿</p>
              <p className="mt-1 text-xs leading-5 text-muted-foreground">
                템플릿 샘플을 확인한 뒤 오른쪽 조건으로 유사 문제를 생성합니다.
              </p>
            </div>
            <div className="mt-4 space-y-2">
              {templates.map((template) => {
                const selected = selectedTemplate?.id === template.id;
                return (
                  <button
                    key={template.id}
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(template.id);
                      setGenerated([]);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition-colors ${
                      selected ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold">
                        {template.subtype}
                      </span>
                      <span className="rounded-md border border-border px-2 py-1 text-xs font-semibold text-muted-foreground">
                        {difficultyLabel(template.difficulty)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-bold">{template.title}</p>
                    {selected ? (
                      <div className="mt-3 space-y-3">
                        <div className="rounded-md border border-dashed border-border bg-background p-2.5">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">출제 규격</p>
                          <ul className="mt-1.5 space-y-1 text-xs leading-5 text-muted-foreground">
                            {template.rules.map((rule) => (
                              <li key={rule}>- {rule}</li>
                            ))}
                          </ul>
                        </div>
                        <ReadingQuestionPreview question={template.question} passage={template.passage} />
                        <div className="grid gap-1">
                          {template.choices.map((choice, index) => (
                            <div
                              key={`${template.id}-${choice}`}
                              className={`rounded-md border px-2 py-1.5 text-xs ${
                                choice === template.answer
                                  ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                                  : "border-border bg-background text-muted-foreground"
                              }`}
                            >
                              {index + 1}. {choice}
                            </div>
                          ))}
                        </div>
                        <p className="text-xs leading-5 text-muted-foreground">{template.explanation}</p>
                      </div>
                    ) : (
                      <ul className="mt-2 space-y-1 text-xs leading-5 text-muted-foreground">
                        {template.rules.slice(0, 2).map((rule) => (
                          <li key={rule}>- {rule}</li>
                        ))}
                      </ul>
                    )}
                  </button>
                );
              })}
            </div>
          </aside>

          <section className="min-w-0 max-h-[calc(100vh-190px)] overflow-y-auto p-5">
            {selectedTemplate && (
              <div className="space-y-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">기준 문제 / 생성 조건</p>
                      <h3 className="mt-1 text-sm font-bold">
                      {source ? "OpenAI 유사 문제 자동 생성" : "선택 템플릿 기준 자동 생성"}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => generateMutation.mutate()}
                      disabled={generateMutation.isPending}
                      className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      title={source ? "선택 템플릿과 조건으로 유사 문제 생성" : "왼쪽에서 선택한 템플릿 샘플을 기준으로 유사 문제 생성"}
                    >
                      {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      유사 문제 자동 생성
                    </button>
                  </div>

                  {source ? (
                    <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <CategoryPathBadge path={source.categoryPath} />
                        <span className="rounded-md border border-border bg-background px-2 py-1 text-xs font-semibold text-muted-foreground">
                          {difficultyLabel(source.difficulty)}
                        </span>
                      </div>
                      <ReadingQuestionPreview question={source.question} passage={source.passage} size="md" />
                    </div>
                  ) : (
                    <div className="mt-4 rounded-md border border-dashed border-border bg-muted/20 p-4 text-sm leading-6 text-muted-foreground">
                      왼쪽에서 선택한 템플릿 샘플을 기준 문제로 사용합니다. 실제 문제 카드의 <span className="font-semibold text-foreground">유사 출제</span> 버튼으로 들어오면 해당 문제의 카테고리와 난이도를 유지합니다.
                    </div>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <label className="space-y-1.5 text-sm font-semibold">
                      <span>문항 수</span>
                      <select
                        value={options.count}
                        onChange={(e) => setOptions((cur) => ({ ...cur, count: Number(e.target.value) }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        {[1, 2, 3, 5].map((count) => (
                          <option key={count} value={count}>{count}개</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm font-semibold">
                      <span>난이도</span>
                      <select
                        value={options.difficulty}
                        onChange={(e) => setOptions((cur) => ({ ...cur, difficulty: e.target.value as SimilarGenerationOptions["difficulty"] }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        <option value="source">기준 문제와 동일</option>
                        {difficulties.map((difficulty) => (
                          <option key={difficulty.value} value={difficulty.value}>{difficulty.label}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1.5 text-sm font-semibold">
                      <span>보기 개수</span>
                      <select
                        value={options.choiceCount}
                        onChange={(e) => setOptions((cur) => ({ ...cur, choiceCount: Number(e.target.value) }))}
                        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                      >
                        {[3, 4, 5].map((count) => (
                          <option key={count} value={count}>{count}개</option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    <ToggleOption
                      label="해설 포함"
                      checked={options.includeExplanation}
                      onChange={(checked) => setOptions((cur) => ({ ...cur, includeExplanation: checked }))}
                    />
                    <ToggleOption
                      label="소재 유사"
                      checked={options.keepTopic}
                      onChange={(checked) => setOptions((cur) => ({ ...cur, keepTopic: checked }))}
                    />
                    <ToggleOption
                      label="중복 방지"
                      checked={options.avoidDuplicate}
                      onChange={(checked) => setOptions((cur) => ({ ...cur, avoidDuplicate: checked }))}
                    />
                  </div>
                </div>

                <div className="rounded-lg border border-border">
                  <div className="flex items-center justify-between border-b border-border px-4 py-3">
                    <h3 className="text-sm font-bold">생성 결과</h3>
                    <span className="text-xs font-semibold text-muted-foreground">{generated.length}건</span>
                  </div>
                  <div className="max-h-[420px] overflow-y-auto p-3">
                    {generated.length === 0 ? (
                      <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                        생성 결과가 없습니다.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {generated.map((item) => (
                          <article key={item.id} className="rounded-md border border-border bg-muted/15 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-muted-foreground">{item.label}</p>
                                <ReadingQuestionPreview question={item.body.question} passage={item.body.passage} size="md" />
                              </div>
                              <button
                                type="button"
                                onClick={() => onUseDraft(item.body)}
                                className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90"
                              >
                                <Plus className="h-3.5 w-3.5" />
                                등록 폼
                              </button>
                            </div>
                            <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                              {(item.body.choices ?? []).map((choice, index) => (
                                <div
                                  key={`${item.id}-${choice}`}
                                  className={`rounded-md border px-2.5 py-1.5 text-xs ${
                                    choice === item.body.answer
                                      ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                                      : "border-border bg-background text-muted-foreground"
                                  }`}
                                >
                                  {index + 1}. {choice}
                                </div>
                              ))}
                            </div>
                            <p className="mt-2 text-xs leading-5 text-muted-foreground">{item.body.explanation}</p>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex h-10 items-center justify-between gap-3 rounded-md border border-border px-3 text-sm font-semibold">
      <span>{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 accent-primary"
      />
    </label>
  );
}

function ReadingQuestionPreview({
  question,
  passage,
  size = "sm",
}: {
  question: string;
  passage?: string | null;
  size?: "sm" | "md";
}) {
  const split = splitQuestionPrompt(question);
  const prompt = split.prompt;
  const displayPassage = passage?.trim() || split.passage;
  const promptClass = size === "md" ? "text-sm" : "text-xs";
  const passageClass = size === "md" ? "text-sm leading-6" : "text-xs leading-5";

  return (
    <div className="space-y-2">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">발문</p>
        <p className={`mt-1 font-semibold ${promptClass}`}>{prompt}</p>
      </div>
      {displayPassage && (
        <div className="rounded-md border border-border bg-background px-3 py-2">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">지문</p>
          <p className={`mt-1 whitespace-pre-line font-medium text-foreground ${passageClass}`}>
            {displayPassage}
          </p>
        </div>
      )}
    </div>
  );
}

type TreeMenuState = {
  x: number;
  y: number;
  node: CategoryNode;
};

type TreeEditorState = {
  mode: "create" | "rename";
  /** create 시 부모(null이면 과목 바로 아래), rename 시 대상 */
  node: CategoryNode | null;
  value: string;
  x: number;
  y: number;
};

function CategoryTree({
  roots,
  totalCount,
  selectedId,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  roots: CategoryNode[];
  totalCount: number;
  selectedId?: number;
  onSelect: (categoryId?: number) => void;
  onCreate: (parentId: number | null, name: string) => void;
  onRename: (id: number, name: string) => void;
  onDelete: (id: number) => void;
}) {
  const { confirm, confirmDialog } = useConfirm();
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [menu, setMenu] = useState<TreeMenuState | null>(null);
  const [editor, setEditor] = useState<TreeEditorState | null>(null);

  useEffect(() => {
    if (!menu && !editor) return;
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-tree-popup]")) {
        setMenu(null);
        setEditor(null);
      }
    };
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenu(null);
        setEditor(null);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [menu, editor]);

  const toggle = (id: number) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const openMenu = (e: ReactMouseEvent, node: CategoryNode) => {
    e.preventDefault();
    e.stopPropagation();
    setEditor(null);
    setMenu({ x: e.clientX, y: e.clientY, node });
  };

  const openEditor = (state: TreeEditorState) => {
    setMenu(null);
    setEditor(state);
  };

  const submitEditor = () => {
    if (!editor) return;
    const name = editor.value.trim();
    if (!name) return;
    if (editor.mode === "create") {
      onCreate(editor.node?.id ?? null, name);
    } else if (editor.node) {
      onRename(editor.node.id, name);
    }
    setEditor(null);
  };

  const isAll = selectedId === undefined;

  const renderNode = (node: CategoryNode, depth: number) => {
    const isOpen = !collapsed.has(node.id);
    const isSelected = selectedId === node.id;
    return (
      <div key={node.id}>
        <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 14 }}>
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent ${
              node.children.length === 0 ? "invisible" : ""
            }`}
            aria-label={isOpen ? "접기" : "펼치기"}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            onContextMenu={(e) => openMenu(e, node)}
            className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
              isSelected ? "bg-primary text-primary-foreground font-semibold" : "hover:bg-accent"
            }`}
            title={`${node.name} (우클릭: 관리 메뉴)`}
          >
            <span className="truncate">{node.name}</span>
            <span className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${
              isSelected ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
            }`}>
              {node.subtreeCount}
            </span>
          </button>
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="self-start overflow-hidden rounded-lg border border-border bg-background">
      <div className="flex items-center justify-between border-b border-question-border bg-question-surface px-4 py-3">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-question-foreground" />
          <h2 className="text-base font-bold">분류</h2>
        </div>
        <button
          type="button"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            openEditor({ mode: "create", node: null, value: "", x: rect.left, y: rect.bottom + 4 });
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          aria-label="분류 추가"
          title="분류 추가"
        >
          <FolderPlus className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-1 p-2">
        <button
          type="button"
          onClick={() => onSelect(undefined)}
          className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm font-semibold transition-colors ${
            isAll ? "bg-primary text-primary-foreground" : "hover:bg-accent"
          }`}
        >
          <span>전체</span>
          <span className={`rounded-md px-1.5 py-0.5 text-xs font-bold ${isAll ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"}`}>
            {totalCount}
          </span>
        </button>

        {roots.map((root) => renderNode(root, 0))}
        {roots.length === 0 && (
          <p className="px-3 py-2 text-xs text-muted-foreground">
            분류가 없습니다. 우측 상단 버튼으로 추가하세요.
          </p>
        )}
      </div>

      {menu && (
        <div
          data-tree-popup
          className="fixed z-[60] w-44 overflow-hidden rounded-md border border-border bg-background py-1 shadow-lg"
          style={{ left: menu.x, top: menu.y }}
        >
          <p className="truncate border-b border-border px-3 py-1.5 text-xs font-bold text-muted-foreground">
            {menu.node.name}
          </p>
          <button
            type="button"
            onClick={() => openEditor({ mode: "create", node: menu.node, value: "", x: menu.x, y: menu.y })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
          >
            <FolderPlus className="h-4 w-4 text-muted-foreground" />
            하위 분류 추가
          </button>
          <button
            type="button"
            onClick={() => openEditor({ mode: "rename", node: menu.node, value: menu.node.name, x: menu.x, y: menu.y })}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm hover:bg-accent"
          >
            <Pencil className="h-4 w-4 text-muted-foreground" />
            이름 변경
          </button>
          <button
            type="button"
            onClick={async () => {
              const target = menu.node;
              setMenu(null);
              if (await confirm({
                title: "분류 삭제",
                description: `"${target.name}" 분류를 삭제할까요?\n하위 분류나 문제가 있으면 삭제할 수 없습니다.`,
                confirmText: "삭제",
                variant: "destructive",
              })) {
                onDelete(target.id);
              }
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <Trash2 className="h-4 w-4" />
            삭제
          </button>
        </div>
      )}

      {editor && (
        <div
          data-tree-popup
          className="fixed z-[60] w-64 rounded-md border border-border bg-background p-3 shadow-lg"
          style={{ left: editor.x, top: editor.y }}
        >
          <p className="text-xs font-bold text-muted-foreground">
            {editor.mode === "create"
              ? editor.node
                ? `"${editor.node.name}" 하위에 추가`
                : "최상위 분류 추가"
              : `"${editor.node?.name}" 이름 변경`}
          </p>
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
            placeholder="분류 이름"
            className="mt-2 h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="mt-2 flex justify-end gap-1.5">
            <button
              type="button"
              onClick={() => setEditor(null)}
              className="inline-flex h-8 items-center rounded-md border border-border px-2.5 text-xs font-semibold hover:bg-accent"
            >
              취소
            </button>
            <button
              type="button"
              onClick={submitEditor}
              disabled={!editor.value.trim()}
              className="inline-flex h-8 items-center rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {editor.mode === "create" ? "추가" : "변경"}
            </button>
          </div>
        </div>
      )}
      {confirmDialog}
    </aside>
  );
}

function CategoryPathBadge({ path }: { path: string[] }) {
  if (path.length === 0) return null;
  return (
    <span className="inline-flex max-w-full items-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold">
      <span className="truncate">{path.join(" > ")}</span>
    </span>
  );
}

function QuestionItem({
  question,
  onEdit,
  onEmbed,
  onListen,
  onShowSimilar,
  onGenerateSimilar,
  onDelete,
}: {
  question: QuestionResponse;
  onEdit: () => void;
  onEmbed: () => void;
  onListen: () => void;
  onShowSimilar: () => void;
  onGenerateSimilar: () => void;
  onDelete: () => void;
}) {
  const embedButtonLabel = question.embeddingStatus === "COMPLETED" ? "재임베딩" : "임베딩";
  const canShowSimilar = question.embeddingStatus === "COMPLETED";
  const readableQuestion = splitReadingQuestion(question);
  const listening = isListeningQuestion(question);

  return (
    <article className="overflow-hidden rounded-lg border border-border bg-background">
      <div className="h-1 bg-question-accent" />
      <div className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <CategoryPathBadge path={question.categoryPath} />
              <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-semibold text-muted-foreground">
                {difficultyLabel(question.difficulty)}
              </span>
              <span className="inline-flex items-center rounded-md border border-violet-200 bg-violet-50 px-2 py-1 text-xs font-semibold text-violet-700">
                {questionTypeLabel(question.questionType)}
              </span>
              <EmbeddingStatusBadge status={question.embeddingStatus} model={question.embeddingModel} />
            </div>
            <h3 className="mt-3 text-base font-bold leading-7">{readableQuestion.prompt}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {listening && readableQuestion.passage && (
              <button
                type="button"
                onClick={onListen}
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
                title="듣기 스크립트를 읽어줍니다."
              >
                <Volume2 className="h-4 w-4" />
                듣기
              </button>
            )}
            <button
              type="button"
              onClick={onEmbed}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
            >
              <Sparkles className="h-4 w-4" />
              {embedButtonLabel}
            </button>
            <button
              type="button"
              onClick={onShowSimilar}
              disabled={!canShowSimilar}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
              title={canShowSimilar ? "유사 문제 조회" : "임베딩 완료된 문제만 조회 가능"}
            >
              <Search className="h-4 w-4" />
              유사 문제
            </button>
            <button
              type="button"
              onClick={onGenerateSimilar}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent"
              title="이 문제를 기준으로 독해 유사 문제 출제"
            >
              <FileText className="h-4 w-4" />
              유사 출제
            </button>
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label="문제 수정"
              title="문제 수정"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={onDelete}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive hover:text-white"
              aria-label="문제 삭제"
              title="문제 삭제"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {readableQuestion.passage && (
          <div className="mt-3 overflow-hidden rounded-md border border-question-border bg-background">
            <p className="border-b border-question-border bg-question-surface px-3 py-2 text-[11px] font-bold text-question-foreground">
              {listening ? "듣기 스크립트" : "지문"}
            </p>
            <p className="whitespace-pre-line px-3 py-2.5 text-sm font-medium leading-7 text-foreground">
              {readableQuestion.passage}
            </p>
          </div>
        )}

        {question.choices.length > 0 && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {question.choices.map((choice, index) => {
              const isAnswer = choice === question.answer;
              return (
                <div
                  key={`${choice}-${index}`}
                  className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm ${
                    isAnswer
                      ? "border-emerald-300 bg-emerald-50 font-semibold text-emerald-800"
                      : "border-border bg-muted/35"
                  }`}
                >
                  {isAnswer && <Check className="h-3.5 w-3.5 shrink-0" />}
                  {index + 1}. {choice}
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className="overflow-hidden rounded-md border border-question-border bg-background">
            <p className="border-b border-question-border bg-question-surface px-3 py-2 text-xs font-bold text-question-foreground">정답</p>
            <p className="px-3 py-2.5 text-sm font-semibold">{question.answer}</p>
          </div>
          <div className="overflow-hidden rounded-md border border-question-border bg-background">
            <p className="border-b border-question-border bg-question-surface px-3 py-2 text-xs font-bold text-question-foreground">키워드</p>
            <div className="flex flex-wrap gap-1.5 px-3 py-2.5">
              {question.keywords.map((keyword) => (
                <span key={keyword} className="rounded-md bg-question-surface-soft px-2 py-1 text-xs font-semibold text-question-foreground">
                  {keyword}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-3 overflow-hidden rounded-md border border-question-border bg-background">
          <p className="border-b border-question-border bg-question-surface px-3 py-2 text-xs font-bold text-question-foreground">해설</p>
          <p className="px-3 py-2.5 text-sm leading-6 text-muted-foreground">{question.explanation}</p>
        </div>
      </div>
    </article>
  );
}

type ListeningSegment = {
  speaker: string | null;
  text: string;
};

const listeningAudioCache = new Map<string, Promise<ArrayBuffer>>();

function splitListeningSegments(value: string): ListeningSegment[] {
  return value
    .split(/\n+/)
    .map((line) => line.trim())
    .map((line) => {
      const match = line.match(/^([^:：]{1,24})[:：]\s*(.+)$/);
      if (!match) return { speaker: null, text: line };
      return { speaker: match[1].trim(), text: match[2].trim() };
    })
    .filter((segment) => segment.text);
}

function voiceForSpeaker(speaker: string | null, speakerIndex: number) {
  const lower = (speaker ?? "").toLowerCase();
  if (lower.includes("girl") || lower.includes("woman")) return "nova";
  if (lower.includes("boy") || lower.includes("man")) return "alloy";
  return speakerIndex % 2 === 0 ? "alloy" : "nova";
}

function speakerAlign(speaker: string | null, speakerIndex: number) {
  const lower = (speaker ?? "").toLowerCase();
  if (lower.includes("girl") || lower.includes("woman")) return "right";
  if (lower.includes("boy") || lower.includes("man")) return "left";
  return speakerIndex % 2 === 0 ? "left" : "right";
}

function speakerDisplayName(speaker: string | null) {
  if (!speaker) return "Narrator";
  return speaker;
}

function listeningAudioCacheKey(text: string, voice: string) {
  return `${voice}:${text}`;
}

function fetchListeningAudio(text: string, voice: string) {
  const key = listeningAudioCacheKey(text, voice);
  const cached = listeningAudioCache.get(key);
  if (cached) return cached;
  const request = agentChatApi.synthesizeSpeech(text, voice).catch((error) => {
    listeningAudioCache.delete(key);
    throw error;
  });
  listeningAudioCache.set(key, request);
  return request;
}

function ListeningDialog({
  question,
  onClose,
}: {
  question: QuestionResponse | null;
  onClose: () => void;
}) {
  const readableQuestion = question ? splitReadingQuestion(question) : null;
  const segments = useMemo(
    () => splitListeningSegments(readableQuestion?.passage ?? ""),
    [readableQuestion?.passage],
  );
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadingAudio, setLoadingAudio] = useState(false);
  const [prefetchingAudio, setPrefetchingAudio] = useState(false);
  const [prefetchedCount, setPrefetchedCount] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlRef = useRef<string | null>(null);
  const stoppedRef = useRef(false);
  const speakerKeys = useMemo(
    () => Array.from(new Set(segments.map((item, i) => item.speaker ?? `speaker-${i % 2}`))),
    [segments],
  );

  useEffect(() => {
    return () => {
      stoppedRef.current = true;
      if (audioRef.current) {
        audioRef.current.onended = null;
        audioRef.current.onerror = null;
        audioRef.current.pause();
        audioRef.current.removeAttribute("src");
        audioRef.current.load();
        audioRef.current = null;
      }
      if (audioUrlRef.current) {
        URL.revokeObjectURL(audioUrlRef.current);
        audioUrlRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!question || segments.length === 0) return;
    let cancelled = false;
    setPrefetchingAudio(true);
    setPrefetchedCount(0);

    const requests = segments.map((segment, index) => {
      const speakerKey = segment.speaker ?? `speaker-${index % 2}`;
      const speakerIndex = speakerKeys.indexOf(speakerKey);
      return fetchListeningAudio(segment.text, voiceForSpeaker(segment.speaker, speakerIndex)).then((buffer) => {
        if (!cancelled) setPrefetchedCount((count) => Math.min(segments.length, count + 1));
        return buffer;
      });
    });

    void Promise.allSettled(requests).finally(() => {
      if (!cancelled) setPrefetchingAudio(false);
    });

    return () => {
      cancelled = true;
    };
  }, [question, segments, speakerKeys]);

  if (!question || !readableQuestion) return null;

  const revokeAudioUrl = () => {
    if (!audioUrlRef.current) return;
    URL.revokeObjectURL(audioUrlRef.current);
    audioUrlRef.current = null;
  };

  const releaseAudioElement = (pause = true) => {
    if (!audioRef.current) return;
    audioRef.current.onended = null;
    audioRef.current.onerror = null;
    if (pause) audioRef.current.pause();
    audioRef.current.removeAttribute("src");
    audioRef.current.load();
    audioRef.current = null;
  };

  const stopAudio = () => {
    stoppedRef.current = true;
    releaseAudioElement();
    revokeAudioUrl();
    setPlaying(false);
    setLoadingAudio(false);
    setActiveIndex(null);
  };

  const playSegment = async (index: number) => {
    if (index >= segments.length) {
      setPlaying(false);
      setLoadingAudio(false);
      setActiveIndex(null);
      return;
    }
    if (stoppedRef.current) return;

    setActiveIndex(index);
    const segment = segments[index];
    const speakerKey = segment.speaker ?? `speaker-${index % 2}`;
    const speakerIndex = speakerKeys.indexOf(speakerKey);

    try {
      setLoadingAudio(true);
      const audioBuffer = await fetchListeningAudio(segment.text, voiceForSpeaker(segment.speaker, speakerIndex));
      if (stoppedRef.current) return;
      releaseAudioElement(false);
      revokeAudioUrl();
      const blob = new Blob([audioBuffer], { type: "audio/mpeg" });
      const url = URL.createObjectURL(blob);
      audioUrlRef.current = url;
      const audio = new Audio(url);
      audioRef.current = audio;
      audio.onended = () => playSegment(index + 1);
      audio.onerror = () => {
        toast.error("듣기 음성 재생에 실패했습니다.");
        stopAudio();
      };
      setLoadingAudio(false);
      await audio.play();
    } catch {
      toast.error("OpenAI TTS 생성에 실패했습니다.");
      setPlaying(false);
      setLoadingAudio(false);
      setActiveIndex(null);
    }
  };

  const play = () => {
    if (segments.length === 0) return;
    stopAudio();
    stoppedRef.current = false;
    setPlaying(true);
    void playSegment(0);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopAudio();
          onClose();
        }
      }}
    >
      <div className="w-full max-w-3xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-border bg-muted/35 px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Listening
            </p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">{readableQuestion.prompt}</h2>
            <p className="mt-1 text-xs text-muted-foreground">{question.categoryPath.join(" > ")}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              stopAudio();
              onClose();
            }}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={play}
              disabled={segments.length === 0 || loadingAudio}
              className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Play className="h-4 w-4" />
              {loadingAudio ? "음성 생성 중" : playing ? "처음부터 다시 듣기" : "듣기 시작"}
            </button>
            <button
              type="button"
              onClick={stopAudio}
              disabled={!playing && activeIndex === null}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-border px-3 text-sm font-semibold hover:bg-accent disabled:opacity-50"
            >
              <Square className="h-4 w-4" />
              정지
            </button>
            {prefetchingAudio && (
              <span className="text-xs font-semibold text-muted-foreground">
                음성 준비 중 {prefetchedCount}/{segments.length}
              </span>
            )}
          </div>

          <div className="mt-4 rounded-md border border-border bg-muted/20 p-3">
            <p className="text-xs font-bold text-muted-foreground">대화 스크립트</p>
            <div className="mt-3 space-y-3">
              {segments.map((segment, index) => {
                const speakerKey = segment.speaker ?? `speaker-${index % 2}`;
                const speakerIndex = speakerKeys.indexOf(speakerKey);
                const align = speakerAlign(segment.speaker, speakerIndex);
                const active = activeIndex === index;
                return (
                  <div
                    key={`${index}-${segment.speaker ?? "speaker"}-${segment.text}`}
                    className={`flex ${align === "right" ? "justify-end" : "justify-start"}`}
                  >
                    <div className={`max-w-[78%] ${align === "right" ? "text-right" : "text-left"}`}>
                      <p className="mb-1 text-[11px] font-bold text-muted-foreground">
                        {speakerDisplayName(segment.speaker)}
                      </p>
                      <p
                        className={`rounded-lg border px-3 py-2 text-sm font-medium leading-7 transition-colors ${
                          active
                            ? "border-yellow-300 bg-yellow-200 text-foreground"
                            : align === "right"
                              ? "border-primary/15 bg-primary/10 text-foreground"
                              : "border-border bg-background text-foreground"
                        }`}
                      >
                        {segment.text}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SingleEmbedDialog({
  target,
  loading,
  onConfirm,
  onCancel,
}: {
  target: QuestionResponse | null;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!target) return null;
  const isReEmbed = target.embeddingStatus === "COMPLETED";
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget && !loading) onCancel();
      }}
    >
      <div className="w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="border-b border-border bg-muted/35 px-5 py-4">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Embedding</p>
          <h2 className="mt-1 text-lg font-bold tracking-tight">
            {isReEmbed ? "이 문제를 다시 임베딩할까요?" : "이 문제를 임베딩 벡터로 변환할까요?"}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            아래 텍스트를 OpenAI text-embedding-3-small 모델로 1536차원 벡터로 변환합니다.
          </p>
        </div>

        <div className="space-y-3 p-5">
          <div>
            <p className="text-xs font-bold text-muted-foreground">대상 문제</p>
            <p className="mt-1 text-sm font-semibold">{target.question}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-muted-foreground">변환할 embeddingText</p>
            <pre className="mt-1 max-h-72 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-neutral-950 p-3 text-xs leading-5 text-neutral-50">
              {target.embeddingText}
            </pre>
          </div>

          <div className="mt-2 flex justify-end gap-2 border-t border-border pt-4">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-semibold transition-colors hover:bg-accent disabled:opacity-60"
            >
              취소
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              임베딩 변환
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required
        className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows: number;
}) {
  return (
    <label className="space-y-1.5 text-sm font-semibold">
      <span>{label}</span>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        required
        className="w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm leading-6 outline-none focus:ring-2 focus:ring-ring"
      />
    </label>
  );
}

function SimilarQuestionsDialog({
  source,
  results,
  loading,
  onClose,
}: {
  source: QuestionResponse | null;
  results: SimilarQuestion[];
  loading: boolean;
  onClose: () => void;
}) {
  if (!source) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-6xl overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Similar Questions</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">유사 문제 조회</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">
              원본 문제의 embedding_vector와 코사인 유사도 기준 상위 {results.length}건입니다.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent"
            aria-label="닫기"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)]">
          <section className="rounded-lg border border-border bg-muted/20 p-4">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">원본 문제</p>
            <SimilarSummary question={source} />
          </section>

          <section className="rounded-lg border border-border bg-background">
            <div className="border-b border-border px-4 py-2.5">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">유사 문제 ({results.length})</p>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-2">
              {loading ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  검색 중
                </div>
              ) : results.length === 0 ? (
                <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                  유사 문제가 없습니다.
                </div>
              ) : (
                <ul className="space-y-2">
                  {results.map((item, idx) => (
                    <li key={item.question.id} className="rounded-md border border-border bg-muted/20 p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                            {idx + 1}
                          </span>
                          <SimilarBadges question={item.question} />
                        </div>
                        <span className="shrink-0 rounded-md border border-border bg-background px-2 py-1 text-xs font-bold tabular-nums">
                          {(item.similarity * 100).toFixed(1)}%
                        </span>
                      </div>
                      <ReadingQuestionPreview question={item.question.question} passage={item.question.passage} size="md" />
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.question.explanation}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

function SimilarSummary({ question }: { question: QuestionResponse }) {
  const readableQuestion = splitReadingQuestion(question);
  return (
    <>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <SimilarBadges question={question} />
      </div>
      <h3 className="mt-3 text-sm font-bold leading-6">{readableQuestion.prompt}</h3>
      {readableQuestion.passage && (
        <div className="mt-2 rounded-md border border-border bg-background px-2.5 py-2">
          <p className="text-[10px] font-bold uppercase text-muted-foreground">지문</p>
          <p className="mt-1 line-clamp-4 whitespace-pre-line text-xs leading-5">{readableQuestion.passage}</p>
        </div>
      )}
      {question.choices.length > 0 && (
        <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
          {question.choices.map((c, i) => (
            <li key={`${c}-${i}`}>
              {i + 1}. {c}
            </li>
          ))}
        </ul>
      )}
      <div className="mt-3 rounded-md border border-border bg-background px-2.5 py-2">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">정답</p>
        <p className="mt-0.5 text-sm font-semibold">{question.answer}</p>
      </div>
      <div className="mt-3 rounded-md border border-border bg-background px-2.5 py-2">
        <p className="text-[10px] font-bold uppercase text-muted-foreground">해설</p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">{question.explanation}</p>
      </div>
    </>
  );
}

function SimilarBadges({ question }: { question: QuestionResponse }) {
  return (
    <>
      <span className="rounded-md border border-border bg-muted px-1.5 py-0.5 text-[10px] font-semibold">
        {question.categoryPath.join(" > ")}
      </span>
      <span className="rounded-md border border-border px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
        {difficultyLabel(question.difficulty)}
      </span>
    </>
  );
}

function EmbeddingStatusBadge({
  status,
  model,
}: {
  status: EmbeddingStatus;
  model: string | null;
}) {
  if (status === "COMPLETED") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700"
        title={model ? `임베딩됨 · ${model}` : "임베딩됨"}
      >
        <Check className="h-3 w-3" />
        임베딩됨
      </span>
    );
  }
  if (status === "FAILED") {
    return (
      <span className="inline-flex items-center gap-1 rounded-md border border-red-200 bg-red-50 px-2 py-1 text-xs font-semibold text-red-700">
        <CircleAlert className="h-3 w-3" />
        임베딩 실패
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
      <Clock className="h-3 w-3" />
      임베딩 대기
    </span>
  );
}
