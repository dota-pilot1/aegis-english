"use client";

import { useMemo } from "react";
import { AgGridReact } from "ag-grid-react";
import {
  ModuleRegistry,
  AllCommunityModule,
  themeQuartz,
  type ColDef,
  type ICellRendererParams,
  type RowSelectionOptions,
  type SelectionChangedEvent,
} from "ag-grid-community";
import { FileText, Pencil, Search, Sparkles, Trash2 } from "lucide-react";
import type {
  QuestionDifficulty,
  QuestionResponse,
  QuestionType,
} from "@/entities/question/api/questionApi";

// ag-grid v33+ 는 모듈 등록이 필수입니다. Community 기능 전체를 한 번에 등록.
ModuleRegistry.registerModules([AllCommunityModule]);

// 디자인 토큰과 대략 맞춘 Quartz 테마 (CSS import 불필요)
const theme = themeQuartz.withParams({
  accentColor: "#0f172a",
  borderRadius: 6,
  headerFontWeight: 700,
  fontFamily: "inherit",
  headerHeight: 40,
  rowHeight: 44,
});

const difficultyLabel = (value: QuestionDifficulty) =>
  value === "easy" ? "하" : value === "hard" ? "상" : "중";

const questionTypeLabel = (value: QuestionType) =>
  value === "MULTIPLE_CHOICE" ? "객관식" : "주관식";

const embeddingLabel: Record<QuestionResponse["embeddingStatus"], string> = {
  COMPLETED: "임베딩됨",
  FAILED: "실패",
  PENDING: "대기",
};

type QuestionGridProps = {
  rows: QuestionResponse[];
  onEdit: (q: QuestionResponse) => void;
  onEmbed: (q: QuestionResponse) => void;
  onShowSimilar: (q: QuestionResponse) => void;
  onGenerateSimilar: (q: QuestionResponse) => void;
  onDelete: (q: QuestionResponse) => void;
  onSelectionChange?: (selected: QuestionResponse[]) => void;
};

type ActionContext = Pick<
  QuestionGridProps,
  "onEdit" | "onEmbed" | "onShowSimilar" | "onGenerateSimilar" | "onDelete"
>;

function ActionsCell(params: ICellRendererParams<QuestionResponse>) {
  const q = params.data;
  const ctx = params.context as ActionContext;
  if (!q) return null;
  const canShowSimilar = q.embeddingStatus === "COMPLETED";
  return (
    <div className="flex h-full items-center gap-1">
      <button
        type="button"
        onClick={() => ctx.onEmbed(q)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        title={q.embeddingStatus === "COMPLETED" ? "재임베딩" : "임베딩"}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => ctx.onShowSimilar(q)}
        disabled={!canShowSimilar}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
        title={canShowSimilar ? "유사 문제" : "임베딩 완료된 문제만 조회 가능"}
      >
        <Search className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => ctx.onGenerateSimilar(q)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        title="독해 유사 출제"
      >
        <FileText className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => ctx.onEdit(q)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
        title="수정"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={() => ctx.onDelete(q)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-destructive hover:text-white"
        title="삭제"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

export function QuestionGrid({
  rows,
  onEdit,
  onEmbed,
  onShowSimilar,
  onGenerateSimilar,
  onDelete,
  onSelectionChange,
}: QuestionGridProps) {
  const columnDefs = useMemo<ColDef<QuestionResponse>[]>(
    () => [
      {
        headerName: "#",
        // 분류는 좌측 트리로 선택하므로 컬럼 대신 행 번호를 표시
        valueGetter: (p) => (p.node?.rowIndex ?? 0) + 1,
        width: 64,
        sortable: false,
        filter: false,
        resizable: false,
      },
      {
        headerName: "난이도",
        valueGetter: (p) => (p.data ? difficultyLabel(p.data.difficulty) : ""),
        width: 90,
      },
      {
        headerName: "유형",
        valueGetter: (p) => (p.data ? questionTypeLabel(p.data.questionType) : ""),
        width: 90,
      },
      {
        headerName: "문제",
        field: "question",
        minWidth: 240,
        flex: 2,
        tooltipField: "question",
      },
      {
        headerName: "정답",
        field: "answer",
        minWidth: 120,
        flex: 1,
        tooltipField: "answer",
      },
      {
        headerName: "임베딩",
        valueGetter: (p) => (p.data ? embeddingLabel[p.data.embeddingStatus] : ""),
        width: 100,
      },
      {
        headerName: "키워드",
        valueGetter: (p) => p.data?.keywords.join(", ") ?? "",
        minWidth: 160,
        flex: 1,
      },
      {
        headerName: "작업",
        cellRenderer: ActionsCell,
        width: 180,
        pinned: "right",
        sortable: false,
        filter: false,
        resizable: false,
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<QuestionResponse>>(
    () => ({
      sortable: true,
      filter: true,
      resizable: true,
    }),
    [],
  );

  const context = useMemo<ActionContext>(
    () => ({ onEdit, onEmbed, onShowSimilar, onGenerateSimilar, onDelete }),
    [onEdit, onEmbed, onShowSimilar, onGenerateSimilar, onDelete],
  );

  // 헤더 체크박스로 전체 선택 + 행마다 체크박스(다중 선택)
  const rowSelection = useMemo<RowSelectionOptions>(
    () => ({ mode: "multiRow" }),
    [],
  );

  const handleSelectionChanged = (event: SelectionChangedEvent<QuestionResponse>) => {
    onSelectionChange?.(event.api.getSelectedRows());
  };

  return (
    <div style={{ height: 560, width: "100%" }}>
      <AgGridReact<QuestionResponse>
        theme={theme}
        rowData={rows}
        columnDefs={columnDefs}
        defaultColDef={defaultColDef}
        context={context}
        getRowId={(p) => p.data.id}
        tooltipShowDelay={300}
        rowSelection={rowSelection}
        onSelectionChanged={handleSelectionChanged}
        pagination
        paginationPageSize={20}
        paginationPageSizeSelector={[20, 50, 100]}
      />
    </div>
  );
}
