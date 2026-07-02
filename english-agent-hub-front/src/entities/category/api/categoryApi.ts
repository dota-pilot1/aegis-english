import { api } from "@/shared/api/axios";

export type CategoryRecord = {
  id: number;
  parentId: number | null;
  name: string;
  displayOrder: number;
  questionCount: number;
};

export type CategoryNode = CategoryRecord & {
  children: CategoryNode[];
  subtreeCount: number;
};

export type CategoryCreateRequest = {
  parentId: number | null;
  name: string;
};

export const categoryApi = {
  list: () =>
    api.get<CategoryRecord[]>("/api/question-categories").then((r) => r.data),
  create: (body: CategoryCreateRequest) =>
    api.post<CategoryRecord>("/api/question-categories", body).then((r) => r.data),
  rename: (id: number, name: string) =>
    api.put<CategoryRecord>(`/api/question-categories/${id}`, { name }).then((r) => r.data),
  delete: (id: number) =>
    api.delete<void>(`/api/question-categories/${id}`).then(() => undefined),
};

export const buildCategoryTree = (flat: CategoryRecord[]): CategoryNode[] => {
  const map = new Map<number, CategoryNode>();
  flat.forEach((record) => map.set(record.id, { ...record, children: [], subtreeCount: 0 }));

  const roots: CategoryNode[] = [];
  map.forEach((node) => {
    if (node.parentId === null || !map.has(node.parentId)) {
      roots.push(node);
    } else {
      map.get(node.parentId)!.children.push(node);
    }
  });

  const fill = (node: CategoryNode): number => {
    node.subtreeCount = node.questionCount + node.children.reduce((sum, child) => sum + fill(child), 0);
    return node.subtreeCount;
  };
  roots.forEach(fill);

  const sortRec = (nodes: CategoryNode[]) => {
    nodes.sort((a, b) => a.displayOrder - b.displayOrder || a.id - b.id);
    nodes.forEach((node) => sortRec(node.children));
  };
  sortRec(roots);
  return roots;
};

/** DFS 순서로 평탄화 — select 옵션용 (depth, 경로 라벨 포함) */
export const flattenCategoryTree = (
  roots: CategoryNode[],
): { id: number; depth: number; name: string; pathLabel: string }[] => {
  const out: { id: number; depth: number; name: string; pathLabel: string }[] = [];
  const walk = (node: CategoryNode, depth: number, path: string[]) => {
    const current = [...path, node.name];
    out.push({ id: node.id, depth, name: node.name, pathLabel: current.join(" > ") });
    node.children.forEach((child) => walk(child, depth + 1, current));
  };
  roots.forEach((root) => walk(root, 0, []));
  return out;
};
