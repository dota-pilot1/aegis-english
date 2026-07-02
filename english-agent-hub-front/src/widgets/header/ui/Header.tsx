"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  BadgeCheck,
  BarChart3,
  BookOpenCheck,
  Calculator,
  ChevronDown,
  ClipboardList,
  Database,
  Eye,
  FileCode2,
  FileSearch,
  FunctionSquare,
  GraduationCap,
  LayoutDashboard,
  Languages,
  LogIn,
  LogOut,
  Menu,
  MessagesSquare,
  MonitorCog,
  NotebookPen,
  Package,
  PlayCircle,
  Settings,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  BookOpenText,
  ListChecks,
  UserCircle,
  UserPlus,
  Users,
  Utensils,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAuth, authActions } from "@/entities/user/model/authStore";
import { menuApi } from "@/entities/menu/api/menuApi";
import type { MenuRecord, MenuItem } from "@/entities/menu/model/types";
import { RoleBadge } from "@/features/user-management/RoleBadge";
import { NavLink } from "@/shared/ui/NavLink";
import { ThemeSwitcher } from "@/shared/ui/theme/ThemeSwitcher";
import { LanguageSelect } from "@/shared/ui/LanguageSelect";

function buildTree(flat: MenuRecord[], userRole: string | null): MenuItem[] {
  const visible = flat.filter(
    (m) => m.visible && (!m.requiredRole || m.requiredRole === userRole)
  );
  const map = new Map<number, MenuItem>();
  visible.forEach((m) => map.set(m.id, { ...m, children: [] }));

  const roots: MenuItem[] = [];
  map.forEach((item) => {
    if (item.parentId === null) {
      roots.push(item);
    } else {
      map.get(item.parentId)?.children.push(item);
    }
  });

  const sort = (items: MenuItem[]) =>
    items.sort((a, b) => a.displayOrder - b.displayOrder);

  map.forEach((item) => sort(item.children));
  return sort(roots);
}

const adminMenuMeta: Record<string, { description: string; icon: LucideIcon }> = {
  ADMIN_DASHBOARD: { description: "운영 상태와 핵심 지표를 한 화면에서 확인합니다.", icon: LayoutDashboard },
  ADMIN_ORDERS: { description: "접수된 주문과 결제 상태를 관리합니다.", icon: ClipboardList },
  ADMIN_KITCHEN: { description: "주방 접수와 진행 상태를 확인합니다.", icon: Utensils },
  ADMIN_SALES: { description: "일별 매출과 결제 흐름을 확인합니다.", icon: BarChart3 },
  ADMIN_SALE_MENUS: { description: "판매 메뉴와 가격을 관리합니다.", icon: ShoppingBag },
  ADMIN_SALE_MENU_CATEGORIES: { description: "메뉴 카테고리와 노출 순서를 정리합니다.", icon: Package },
  ADMIN_SALE_MENU_AVAILABILITY: { description: "품절, 숨김, 노출 상태를 조정합니다.", icon: Eye },
  ADMIN_USERS: { description: "회원 계정을 확인하고 역할을 조정합니다.", icon: Users },
  ADMIN_ROLES: { description: "시스템 롤과 커스텀 롤을 관리합니다.", icon: BadgeCheck },
  ADMIN_ROLE_PERMISSIONS: { description: "역할별 접근 권한을 매핑합니다.", icon: ShieldCheck },
  ADMIN_QUESTION_BANK: { description: "문제 저장, 조회, 유사문항 PoC 데이터를 관리합니다.", icon: BookOpenCheck },
  PRACTICE: { description: "발행된 시험지를 선택해 문제를 풀고 채점 결과를 확인합니다.", icon: PlayCircle },
  LEARNING_RESULTS: { description: "내 응시 기록과 채점 결과를 확인합니다.", icon: BarChart3 },
  ENGLISH_CONVERSATION: { description: "AI 영어 회화 파트너와 대화하고 표현 피드백을 받습니다.", icon: MessagesSquare },
  QUESTION_BANK: { description: "무한 카테고리 트리로 문제를 분류하고 유사 문항을 관리합니다.", icon: BookOpenCheck },
  EXAM_MANAGE: { description: "문제 은행으로 시험지를 구성하고 발행·채점합니다.", icon: ClipboardList },
  QUESTION_GEN_EN: { description: "출제 명세 기반으로 새 영어 문제를 생성·테스트합니다.", icon: Sparkles },
  QUESTION_GEN_MATH: { description: "출제 명세 기반으로 새 수학 문제를 생성·테스트합니다.", icon: Calculator },
  QUESTION_EXTRACTOR: { description: "영어 시험지 PDF에서 독해 문항 텍스트를 추출합니다.", icon: FileSearch },
  QUESTION_EXTRACTOR_MATH: { description: "수학 시험지 PDF를 이미지로 잘라 문항(수식·도형 보존)을 추출합니다.", icon: Calculator },
  QUESTION_EXTRACTOR_MATH2: { description: "수학 문항을 LaTeX 텍스트로 전사하고 도형만 이미지로 분리(정형)합니다.", icon: FunctionSquare },
  REFERENCE_DATA: { description: "문제 출제와 검수에 쓰는 기준 데이터를 관리합니다.", icon: Database },
  REFERENCE_VOCABULARY: { description: "교육과정 기반 기본 어휘와 난이도, 출처를 조회합니다.", icon: BookOpenText },
  REFERENCE_IDIOMS: { description: "숙어, 구동사, 관용표현 기준 데이터를 조회합니다.", icon: Languages },
  REFERENCE_GRAMMAR: { description: "문법 포인트와 출제 기준을 학년·과목별로 정리합니다.", icon: ListChecks },
  REFERENCE_QUESTION_TYPES: { description: "빈칸, 순서, 삽입, 어법 등 문항 유형 기준을 관리합니다.", icon: ClipboardList },
  REFERENCE_CURRICULUM: { description: "교육과정 버전과 과목별 성취기준을 조회합니다.", icon: GraduationCap },
  RESULTS: { description: "성적과 학습 결과를 확인합니다.", icon: BarChart3 },
  EXAM_RESULTS: { description: "시험별 응시자 성적과 채점 결과를 확인합니다.", icon: BarChart3 },
  WRONG_ANSWER_NOTE: { description: "응시자가 틀린 문항만 모아 정답·해설과 함께 복습합니다.", icon: NotebookPen },
  ADMIN_SITE_SETTINGS: { description: "메인 화면과 매장 소개 설정을 편집합니다.", icon: MonitorCog },
  ADMIN_SCREEN_SETTINGS: { description: "화면 안내 문구와 표시 설정을 편집합니다.", icon: MonitorCog },
  ADMIN_NAV_MANAGEMENT: { description: "상단 헤더 메뉴와 노출 구성을 조정합니다.", icon: Menu },
  ADMIN_MENU_MANAGEMENT: { description: "상단 헤더 메뉴와 노출 구성을 조정합니다.", icon: Menu },
  API_DOCS_SWAGGER: { description: "전체 REST API 명세(OpenAPI)를 조회하고 Try it out 으로 테스트합니다.", icon: FileCode2 },
  API_DOCS_KEY: { description: "외부 협업에 자주 쓰는 핵심 엔드포인트와 인증 흐름을 빠르게 참고합니다.", icon: ListChecks },
};

function flattenLeaves(item: MenuItem): MenuItem[] {
  if (item.children.length === 0) return item.path ? [item] : [];
  return item.children.flatMap(flattenLeaves);
}

function AdminMegaMenu({ item }: { item: MenuItem }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const leaves = flattenLeaves(item);
  const isActive = leaves.some((leaf) => leaf.path && pathname.startsWith(leaf.path));
  const groups =
    item.children.some((child) => child.children.length > 0)
      ? item.children
      : [{ ...item, id: -1, label: item.label, children: item.children }];

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className={`inline-flex h-9 items-center gap-1 border-b-2 px-1 text-sm transition-colors ${
          isActive || open
            ? "border-primary text-foreground font-medium"
            : "border-transparent text-muted-foreground hover:text-foreground"
        }`}
      >
        {item.label}
        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[380px] overflow-hidden rounded-lg border border-border bg-background shadow-xl">
          <section className="flex flex-col gap-4 bg-background p-3">
            {groups.map((group) => {
              const children = group.children.filter((child) => child.path || child.children.length > 0);
              if (children.length === 0) return null;

              return (
                <div key={group.id} className="space-y-2">
                  <h4 className="px-2 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
                    {group.label}
                  </h4>
                  <div className="space-y-1">
                    {children.flatMap((child) =>
                      child.children.length > 0 ? child.children : [child]
                    ).map((child) => {
                      const meta = adminMenuMeta[child.code] ?? {
                        description: "관리 기능으로 이동합니다.",
                        icon: Settings,
                      };
                      const Icon = meta.icon;

                      return (
                        <Link
                          key={child.id}
                          href={child.path ?? "#"}
                          target={child.isExternal ? "_blank" : undefined}
                          rel={child.isExternal ? "noopener noreferrer" : undefined}
                          onClick={() => setOpen(false)}
                          className="group flex gap-3 rounded-md border border-transparent bg-background p-2.5 transition-colors hover:border-primary hover:bg-accent"
                        >
                          <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground">
                            <Icon className="h-4 w-4" />
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-foreground">
                              {child.label}
                            </span>
                            <span className="mt-0.5 line-clamp-2 block text-xs leading-5 text-muted-foreground">
                              {meta.description}
                            </span>
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        </div>
      )}
    </div>
  );
}

function NavItem({ item }: { item: MenuItem; key?: React.Key }) {
  if (item.children.length > 0) {
    return <AdminMegaMenu item={item} />;
  }
  return (
    <NavLink href={item.path ?? "#"} exact={item.path === "/dashboard"}>
      {item.label}
    </NavLink>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = (name ?? "?").slice(0, 2).toUpperCase();
  return (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-[10px] font-bold select-none">
      {initials}
    </span>
  );
}

function UserDropdown({
  displayName,
  user,
  onLogout,
}: {
  displayName: string;
  user: NonNullable<ReturnType<typeof useAuth>["user"]>;
  onLogout: () => void;
}) {
  const { t } = useTranslation("nav");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-2.5 transition-colors hover:bg-accent"
      >
        <UserAvatar name={displayName} />
        <span className="text-sm font-medium leading-none text-foreground">
          {displayName}
        </span>
        {user.role && (
          <>
            <span className="h-3.5 w-px bg-border/80" />
            <RoleBadge role={user.role} />
          </>
        )}
        <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-md border border-border bg-background shadow-lg z-50 py-1 overflow-hidden">
          <div className="border-b border-border px-3 py-2.5">
            <div className="flex items-center gap-2">
              <UserAvatar name={displayName} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            {user.role && <div className="mt-2"><RoleBadge role={user.role} /></div>}
          </div>
          <Link
            href="/profile"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <UserCircle className="h-4 w-4" />
            {t("profile")}
          </Link>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onLogout();
            }}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <LogOut className="h-4 w-4" />
            {t("logout")}
          </button>
        </div>
      )}
    </div>
  );
}

function MobileNav({ tree }: { tree: MenuItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // 라우트 이동 시 자동으로 닫기
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div ref={ref} className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="메뉴 열기"
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-foreground transition-colors hover:bg-accent"
      >
        {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </button>

      {open && (
        <div className="absolute left-0 right-0 top-full z-50 max-h-[calc(100vh-3.5rem)] overflow-y-auto border-b border-border bg-background shadow-lg">
          <nav className="flex flex-col gap-1 p-3">
            {tree.map((item) => {
              const leaves = flattenLeaves(item);
              if (item.children.length === 0) {
                const active = item.path && pathname.startsWith(item.path);
                return (
                  <Link
                    key={item.id}
                    href={item.path ?? "#"}
                    onClick={() => setOpen(false)}
                    className={`rounded-md px-3 py-2.5 text-sm transition-colors ${
                      active
                        ? "bg-accent font-medium text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {item.label}
                  </Link>
                );
              }
              return (
                <div key={item.id} className="pt-1">
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {item.label}
                  </p>
                  {leaves.map((leaf) => {
                    const active = leaf.path && pathname.startsWith(leaf.path);
                    return (
                      <Link
                        key={leaf.id}
                        href={leaf.path ?? "#"}
                        target={leaf.isExternal ? "_blank" : undefined}
                        rel={leaf.isExternal ? "noopener noreferrer" : undefined}
                        onClick={() => setOpen(false)}
                        className={`block rounded-md px-3 py-2.5 text-sm transition-colors ${
                          active
                            ? "bg-accent font-medium text-foreground"
                            : "text-muted-foreground hover:bg-accent hover:text-foreground"
                        }`}
                      >
                        {leaf.label}
                      </Link>
                    );
                  })}
                </div>
              );
            })}
          </nav>
        </div>
      )}
    </div>
  );
}

export function Header() {
  const { t } = useTranslation("nav");
  const { status, user } = useAuth();
  const router = useRouter();

  const userRole = user?.role?.code ?? null;

  const { data: flatMenus = [] } = useQuery({
    queryKey: ["menus"],
    queryFn: menuApi.getAll,
    staleTime: 1000 * 60 * 5,
  });

  const tree = buildTree(flatMenus, userRole);

  const handleLogout = async () => {
    await authActions.logout();
    router.replace("/login");
  };

  const displayName = user?.username ?? user?.email ?? "?";

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-sm">
      <div className="relative flex h-14 w-full items-center justify-between px-4">
        <nav className="flex min-w-0 items-center gap-2 md:gap-5">
          {status === "authenticated" && tree.length > 0 && (
            <MobileNav tree={tree} />
          )}
          <Link
            href="/"
            className="mr-2 text-sm font-semibold tracking-tight hover:opacity-80 transition-opacity"
          >
            AEGIS
          </Link>
          {status === "authenticated" && (
            <div className="hidden items-center gap-5 md:flex">
              {tree.map((item) => (
                <NavItem key={item.id} item={item} />
              ))}
            </div>
          )}
        </nav>

        <div className="flex items-center gap-2">
          <LanguageSelect />
          <ThemeSwitcher />
          {status === "authenticated" ? (
            user && <UserDropdown displayName={displayName} user={user} onLogout={handleLogout} />
          ) : status === "anonymous" ? (
            <>
              <Link
                href="/register"
                className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-foreground transition-colors hover:bg-accent"
              >
                <UserPlus className="h-4 w-4 text-muted-foreground" />
                <span className="hidden sm:inline text-sm font-medium leading-none">
                  {t("register")}
                </span>
              </Link>
              <Link
                href="/login"
                className="inline-flex h-9 items-center gap-2 rounded-md bg-primary px-3 text-primary-foreground transition-opacity hover:opacity-90"
              >
                <LogIn className="h-4 w-4" />
                <span className="hidden sm:inline text-sm font-medium leading-none">
                  {t("login")}
                </span>
              </Link>
            </>
          ) : null}
        </div>
      </div>
    </header>
  );
}
