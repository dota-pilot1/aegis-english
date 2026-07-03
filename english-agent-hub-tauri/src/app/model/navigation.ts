import {
  BookOpenCheck,
  MessagesSquare,
  PlayCircle,
  type LucideIcon,
} from "lucide-react";
import type { UserSummary } from "../../entities/user/model/types";

export type WebMenuId = "practice" | "englishConversation" | "questionMgmt";

export type WebMenu = {
  id: WebMenuId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  children?: string[];
};

export const WEB_HEADER_MENUS: WebMenu[] = [
  {
    id: "practice",
    label: "시험 응시",
    subtitle: "발행 시험 · 풀이 · 채점 결과",
    icon: PlayCircle,
  },
  {
    id: "englishConversation",
    label: "영어 회화",
    subtitle: "AI 회화 · 표현 피드백",
    icon: MessagesSquare,
  },
  {
    id: "questionMgmt",
    label: "문제 은행",
    subtitle: "문제 조회 · 복습",
    icon: BookOpenCheck,
  },
];

export function canAccessMenu(user: UserSummary | null, menu: WebMenuId) {
  return user !== null && WEB_HEADER_MENUS.some((item) => item.id === menu);
}
