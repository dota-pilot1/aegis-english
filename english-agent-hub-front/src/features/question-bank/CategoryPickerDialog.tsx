"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronRight, CornerDownRight, X } from "lucide-react";
import type { CategoryNode } from "@/entities/category/api/categoryApi";

/**
 * 카테고리 트리 피커 다이얼로그.
 * 중간 분류는 펼침/접힘만 가능하고, 문제는 리프(말단) 분류에만 달 수 있다.
 */
export function CategoryPickerDialog({
  open,
  roots,
  selectedId,
  onConfirm,
  onClose,
}: {
  open: boolean;
  roots: CategoryNode[];
  selectedId: number | null;
  onConfirm: (node: CategoryNode) => void;
  onClose: () => void;
}) {
  const [currentId, setCurrentId] = useState<number | null>(selectedId);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (open) {
      setCurrentId(selectedId);
      setCollapsed(new Set());
    }
  }, [open, selectedId]);

  useEffect(() => {
    if (!open) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [open, onClose]);

  const { nodeById, pathById } = useMemo(() => {
    const nodeById = new Map<number, CategoryNode>();
    const pathById = new Map<number, string>();
    const walk = (node: CategoryNode, path: string[]) => {
      const current = [...path, node.name];
      nodeById.set(node.id, node);
      pathById.set(node.id, current.join(" > "));
      node.children.forEach((child) => walk(child, current));
    };
    roots.forEach((root) => walk(root, []));
    return { nodeById, pathById };
  }, [roots]);

  if (!open) return null;

  const current = currentId !== null ? (nodeById.get(currentId) ?? null) : null;
  const canConfirm = !!current && current.children.length === 0;

  const toggle = (id: number) =>
    setCollapsed((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const renderNode = (node: CategoryNode, depth: number) => {
    const isLeaf = node.children.length === 0;
    const isOpen = !collapsed.has(node.id);
    const isSelected = currentId === node.id;
    return (
      <div key={node.id}>
        <div className="flex items-center gap-0.5" style={{ paddingLeft: depth * 16 }}>
          <button
            type="button"
            onClick={() => toggle(node.id)}
            className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent ${
              isLeaf ? "invisible" : ""
            }`}
            aria-label={isOpen ? "접기" : "펼치기"}
          >
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => (isLeaf ? setCurrentId(node.id) : toggle(node.id))}
            onDoubleClick={() => {
              if (isLeaf) onConfirm(node);
            }}
            className={`flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors ${
              isLeaf
                ? isSelected
                  ? "bg-primary font-semibold text-primary-foreground"
                  : "hover:bg-accent"
                : "font-semibold text-muted-foreground hover:bg-accent"
            }`}
            title={isLeaf ? "이 분류 선택" : "하위 분류를 펼쳐 말단 분류를 선택하세요"}
          >
            <span className="flex min-w-0 items-center gap-1.5">
              {isLeaf && (
                <Check
                  className={`h-3.5 w-3.5 shrink-0 ${isSelected ? "" : "invisible"}`}
                />
              )}
              <span className="truncate">{node.name}</span>
            </span>
            <span
              className={`ml-2 shrink-0 rounded-md px-1.5 py-0.5 text-xs font-bold ${
                isSelected && isLeaf ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
              }`}
            >
              {node.subtreeCount}
            </span>
          </button>
        </div>
        {isOpen && node.children.map((child) => renderNode(child, depth + 1))}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-[70] flex items-start justify-center overflow-y-auto bg-foreground/35 px-4 py-10"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md overflow-hidden rounded-lg border border-border bg-background shadow-xl">
        <div className="flex items-center justify-between border-b border-border bg-muted/35 px-5 py-4">
          <div>
            <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Category</p>
            <h2 className="mt-1 text-lg font-bold tracking-tight">카테고리 선택</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">문제는 말단 분류에만 등록할 수 있습니다.</p>
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

        <div className="max-h-[50vh] space-y-0.5 overflow-y-auto p-2">
          {roots.map((root) => renderNode(root, 0))}
          {roots.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-muted-foreground">선택할 수 있는 분류가 없습니다.</p>
          )}
        </div>

        <div className="border-t border-border px-5 py-4">
          <div className="flex min-h-9 items-center gap-1.5 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs">
            <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {current ? (
              <span className={`truncate font-semibold ${canConfirm ? "" : "text-muted-foreground"}`}>
                {pathById.get(current.id)}
                {!canConfirm && " — 말단 분류가 아닙니다"}
              </span>
            ) : (
              <span className="text-muted-foreground">분류를 선택하세요.</span>
            )}
          </div>
          <div className="mt-3 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 items-center rounded-md border border-border bg-background px-3 text-sm font-semibold hover:bg-accent"
            >
              취소
            </button>
            <button
              type="button"
              disabled={!canConfirm}
              onClick={() => current && onConfirm(current)}
              className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              <Check className="h-4 w-4" />
              이 분류로 선택
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
