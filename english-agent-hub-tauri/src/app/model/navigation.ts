import {
  BookOpenCheck,
  MessagesSquare,
  PlayCircle,
  Settings,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import type { UserSummary } from "../../entities/user/model/types";

export type WebMenuId = "englishConversation" | "practice" | "questionMgmt" | "questionGen" | "admin";

export type WebMenu = {
  id: WebMenuId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  children?: string[];
};

export const WEB_HEADER_MENUS: WebMenu[] = [
  {
    id: "englishConversation",
    label: "영어 회화",
    subtitle: "AI 회화 · 표현 피드백",
    icon: MessagesSquare,
  },
  {
    id: "practice",
    label: "시험 응시",
    subtitle: "발행 시험 · 풀이 · 채점 결과",
    icon: PlayCircle,
  },
  {
    id: "questionMgmt",
    label: "문제 관리",
    subtitle: "문제 은행 · 시험 출제",
    icon: BookOpenCheck,
    children: ["문제 은행", "시험 출제"],
  },
  {
    id: "questionGen",
    label: "문제 생성",
    subtitle: "영어 · 수학 · 추출",
    icon: Sparkles,
    children: ["영어 문제 생성기", "수학 문제 생성기", "문제 추출"],
  },
  {
    id: "admin",
    label: "설정 관리",
    subtitle: "유저 · 권한 · 기준정보",
    icon: Settings,
    children: ["유저 관리", "롤 관리", "기준정보", "헤더 메뉴 관리"],
  },
];

export function canAccessMenu(user: UserSummary | null, menu: WebMenuId) {
  if (menu === "englishConversation" || menu === "practice") return true;
  return user?.role.code === "ROLE_ADMIN";
}
