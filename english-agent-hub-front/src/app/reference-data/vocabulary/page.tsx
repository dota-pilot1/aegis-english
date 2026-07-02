"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AgGridReact } from "ag-grid-react";
import {
  AllCommunityModule,
  ModuleRegistry,
  themeQuartz,
  type ColDef,
} from "ag-grid-community";
import {
  BookOpenText,
  ChevronRight,
  Search,
} from "lucide-react";
import { RequireRole } from "@/widgets/guards/RequireRole";
import {
  englishVocabularyApi,
  type EnglishVocabularyItem,
  type EnglishVocabularyLimit,
  type EnglishVocabularyMarker,
} from "@/entities/reference-data/api/englishVocabularyApi";

ModuleRegistry.registerModules([AllCommunityModule]);

const gridTheme = themeQuartz.withParams({
  accentColor: "#0f172a",
  borderRadius: 6,
  headerBackgroundColor: "#111827",
  headerTextColor: "#ffffff",
  headerFontWeight: 700,
  fontFamily: "inherit",
  headerHeight: 40,
  rowHeight: 42,
});

type VocabularyCategory = {
  id: string;
  label: string;
  count: number;
  marker?: EnglishVocabularyMarker;
  children?: VocabularyCategory[];
};

const markerByCategoryId: Record<string, EnglishVocabularyMarker | undefined> = {
  elementary: "ELEMENTARY_RECOMMENDED",
  common: "COMMON_RECOMMENDED",
  advanced: "ADVANCED_RECOMMENDED",
};

const visibleSubjectLimits = new Set(["기본영어 1, 2", "공통영어 1, 2", "영어Ⅰ", "영어Ⅱ"]);

function displaySubjectName(value: string) {
  return value.replace("Ⅰ", "I").replace("Ⅱ", "II");
}

function formatCount(value: number) {
  return value.toLocaleString();
}

function buildCategories(items: EnglishVocabularyItem[], limits: EnglishVocabularyLimit[]): VocabularyCategory[] {
  const countByMarker = items.reduce<Record<EnglishVocabularyMarker, number>>(
    (acc, item) => {
      acc[item.marker] += 1;
      return acc;
    },
    {
      ELEMENTARY_RECOMMENDED: 0,
      COMMON_RECOMMENDED: 0,
      ADVANCED_RECOMMENDED: 0,
    },
  );

  const highLimits = limits.filter((limit) => visibleSubjectLimits.has(limit.subjectName));
  return [
    {
      id: "grade",
      label: "어휘 등급",
      count: items.length,
      children: [
        {
          id: "elementary",
          label: "초등 권장(*)",
          count: countByMarker.ELEMENTARY_RECOMMENDED,
          marker: "ELEMENTARY_RECOMMENDED",
        },
        {
          id: "common",
          label: "중·고 공통(**)",
          count: countByMarker.COMMON_RECOMMENDED,
          marker: "COMMON_RECOMMENDED",
        },
        {
          id: "advanced",
          label: "고등 선택/심화",
          count: countByMarker.ADVANCED_RECOMMENDED,
          marker: "ADVANCED_RECOMMENDED",
        },
      ],
    },
    {
      id: "subject-limits",
      label: "과목별 어휘 수 기준",
      count: highLimits.length,
      children: highLimits.map((limit) => ({
        id: `limit-${limit.id}`,
        label: displaySubjectName(limit.subjectName),
        count: limit.wordLimit,
      })),
    },
    {
      id: "source",
      label: "출처/버전",
      count: 1,
      children: [{ id: "rnce-2022", label: "2022 개정", count: items.length }],
    },
  ];
}

function CategoryNode({
  item,
  selectedId,
  onSelect,
  expandedIds,
  onToggle,
}: {
  item: VocabularyCategory;
  selectedId: string;
  onSelect: (id: string) => void;
  expandedIds: Set<string>;
  onToggle: (id: string) => void;
}) {
  const isSelected = selectedId === item.id;
  const hasChildren = !!item.children?.length;
  const isExpanded = expandedIds.has(item.id);
  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => {
          onSelect(item.id);
          if (hasChildren) onToggle(item.id);
        }}
        className={`flex h-9 w-full items-center justify-between rounded-md px-2 text-left text-sm transition-colors ${
          isSelected
            ? "bg-primary text-primary-foreground"
            : "text-foreground hover:bg-accent"
        }`}
      >
        <span className="flex min-w-0 items-center gap-1.5">
          {hasChildren && (
            <ChevronRight className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
          )}
          <span className="truncate font-medium">{item.label}</span>
        </span>
        <span
          className={`shrink-0 text-xs ${
            isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
          }`}
        >
          {item.count.toLocaleString()}
        </span>
      </button>
      {hasChildren && isExpanded && (
        <div className="ml-4 border-l border-border pl-2">
          {item.children?.map((child) => (
            <CategoryNode
              key={child.id}
              item={child}
              selectedId={selectedId}
              onSelect={onSelect}
              expandedIds={expandedIds}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VocabularyDictionaryPage() {
  return (
    <RequireRole roles={["ROLE_ADMIN"]}>
      <VocabularyDictionaryWorkspace />
    </RequireRole>
  );
}

function VocabularyDictionaryWorkspace() {
  const [selectedCategoryId, setSelectedCategoryId] = useState("grade");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(["grade", "subject-limits", "source"]),
  );
  const [query, setQuery] = useState("");

  const selectedMarker = markerByCategoryId[selectedCategoryId];
  const normalizedQuery = query.trim();

  const { data: allItems = [], isLoading: allItemsLoading } = useQuery({
    queryKey: ["english-vocabulary", "all"],
    queryFn: () => englishVocabularyApi.list(),
  });
  const { data: rows = [], isLoading: rowsLoading } = useQuery({
    queryKey: ["english-vocabulary", selectedMarker ?? "all", normalizedQuery],
    queryFn: () => englishVocabularyApi.list({ marker: selectedMarker, keyword: normalizedQuery }),
  });
  const { data: limits = [], isLoading: limitsLoading } = useQuery({
    queryKey: ["english-vocabulary-limits"],
    queryFn: englishVocabularyApi.limits,
  });

  const categories = useMemo(
    () => buildCategories(allItems, limits),
    [allItems, limits],
  );

  const commonEnglishLimit = limits.find((limit) => limit.subjectName === "공통영어 1, 2");
  const englishIILimit = limits.find((limit) => limit.subjectName === "영어Ⅱ");
  const isLoading = allItemsLoading || rowsLoading || limitsLoading;

  const handleToggleCategory = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const columnDefs = useMemo<ColDef<EnglishVocabularyItem>[]>(
    () => [
      { headerName: "#", field: "sortOrder", width: 84, pinned: "left" },
      { headerName: "단어", field: "headword", pinned: "left", width: 150 },
      {
        headerName: "뜻",
        valueGetter: (params) => params.data?.meaningKo ?? "",
        minWidth: 180,
        flex: 1,
      },
      {
        headerName: "품사",
        valueGetter: (params) => params.data?.partOfSpeech ?? "",
        width: 110,
      },
      {
        headerName: "예문",
        valueGetter: (params) => params.data?.exampleSentence ?? "",
        minWidth: 240,
        flex: 2,
        tooltipValueGetter: (params) => {
          const sentence = params.data?.exampleSentence;
          const translation = params.data?.exampleTranslation;
          return [sentence, translation].filter(Boolean).join("\n");
        },
      },
    ],
    [],
  );

  const defaultColDef = useMemo<ColDef<EnglishVocabularyItem>>(
    () => ({ sortable: true, filter: true, resizable: true }),
    [],
  );

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25 px-4 py-5">
      <div className="mx-auto w-full max-w-[1440px] space-y-5">
        <header className="flex flex-col gap-4 border-b border-border pb-5 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="inline-flex h-8 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground">
              <BookOpenText className="h-4 w-4 text-primary" />
              Reference Data
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight">어휘 사전</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              교육과정 기본 어휘를 조회하고 문제 생성·검수 기준으로 관리합니다.
            </p>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="rounded-lg border border-border bg-background">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-bold">어휘 카테고리</h2>
              <p className="mt-1 text-xs text-muted-foreground">등급, 과목 기준, 출처</p>
            </div>
            <div className="space-y-2 p-3">
              {categories.map((category) => (
                <CategoryNode
                  key={category.id}
                  item={category}
                  selectedId={selectedCategoryId}
                  onSelect={setSelectedCategoryId}
                  expandedIds={expandedIds}
                  onToggle={handleToggleCategory}
                />
              ))}
            </div>
          </aside>

          <section className="min-w-0 rounded-lg border border-border bg-background">
            <div className="flex flex-col gap-3 border-b border-border p-4 xl:flex-row xl:items-center xl:justify-between">
              <label className="relative block w-full xl:w-96">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="단어, 뜻, 예문 검색"
                  className="h-9 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <div className="grid grid-cols-3 gap-2 text-sm xl:w-auto">
                <div className="rounded-md border border-border px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">기본 어휘</p>
                  <p className="font-bold">{formatCount(allItems.length)}개</p>
                </div>
                <div className="rounded-md border border-border px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">공통영어</p>
                  <p className="font-bold">
                    {commonEnglishLimit ? `${formatCount(commonEnglishLimit.wordLimit)}개 이내` : "-"}
                  </p>
                </div>
                <div className="rounded-md border border-border px-3 py-1.5">
                  <p className="text-xs text-muted-foreground">영어 II</p>
                  <p className="font-bold">
                    {englishIILimit ? `${formatCount(englishIILimit.wordLimit)}개 이내` : "-"}
                  </p>
                </div>
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>조회 {formatCount(rows.length)}건</span>
                <span>교육부 기본 어휘 기준</span>
              </div>
              <div className="h-[560px] w-full [&_.ag-header-cell]:border-r [&_.ag-header-cell]:border-slate-700 [&_.ag-header-cell-label]:text-white [&_.ag-paging-panel]:border-t [&_.ag-paging-panel]:border-border [&_.ag-paging-panel]:bg-muted/60 [&_.ag-paging-panel]:font-medium">
                <AgGridReact<EnglishVocabularyItem>
                  theme={gridTheme}
                  rowData={rows}
                  columnDefs={columnDefs}
                  defaultColDef={defaultColDef}
                  getRowId={(params) => params.data.id}
                  loading={isLoading}
                  pagination
                  paginationPageSize={20}
                  paginationPageSizeSelector={[20, 50, 100]}
                />
              </div>
            </div>
          </section>
        </section>
      </div>
    </main>
  );
}
