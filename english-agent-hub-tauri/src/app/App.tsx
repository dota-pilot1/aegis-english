import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { Select, type SelectOption } from "../shared/ui/Select";
import {
  ArrowLeft,
  BookOpenCheck,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clock,
  Eye,
  EyeOff,
  FolderPlus,
  History as HistoryIcon,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Loader2,
  LogIn,
  LogOut,
  MessagesSquare,
  Mic,
  Paperclip,
  RefreshCw,
  Save,
  Search,
  Send,
  Settings,
  Settings2,
  Sparkles,
  Trash2,
  Volume2,
  WandSparkles,
  type LucideIcon,
} from "lucide-react";

type Agent = {
  id: string;
  title: string;
  subtitle?: string;
  description?: string;
  sessionGoal?: string;
};

type Message = {
  id: string;
  role: "learner" | "agent";
  text: string;
  translatedText?: string;
  imageUrl?: string;
  streaming?: boolean;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

type CategoryRecord = {
  id: number;
  parentId: number | null;
  name: string;
  displayOrder: number;
  questionCount: number;
};

type CategoryNode = CategoryRecord & {
  children: CategoryNode[];
  subtreeCount: number;
};

type EmbeddingStatusResponse = {
  pending: number;
  completed: number;
  failed: number;
};

type QuestionDifficulty = "easy" | "medium" | "hard";

type QuestionType = "MULTIPLE_CHOICE" | "SHORT_ANSWER";

type EmbeddingStatus = "PENDING" | "COMPLETED" | "FAILED";

type QuestionKind =
  | "GENERAL"
  | "LISTENING_PURPOSE_OPINION"
  | "LISTENING_RELATION_PLACE"
  | "LISTENING_VISUAL_CHART"
  | "LISTENING_TASK_REASON"
  | "LISTENING_DETAIL"
  | "LISTENING_LONG_TALK"
  | "MAIN_IDEA"
  | "PURPOSE"
  | "CLAIM"
  | "GIST"
  | "TOPIC"
  | "TITLE"
  | "DETAIL_CHART"
  | "DETAIL_MATCH"
  | "PRACTICAL_TEXT"
  | "VOCAB_CONTEXT"
  | "VOCAB_UNDERLINED"
  | "GRAMMAR_CHECK"
  | "BLANK_WORD"
  | "BLANK_PHRASE"
  | "BLANK_SENTENCE"
  | "IRRELEVANT_SENTENCE"
  | "ORDERING"
  | "SENTENCE_INSERTION"
  | "SUMMARY_COMPLETION"
  | "LONG_READING_SET"
  | "COMPOSITE_READING";

type QuestionSourceType = "UNKNOWN" | "CSAT" | "MOCK" | "CUSTOM";

type QuestionResponse = {
  id: string;
  questionType: QuestionType;
  questionKind: QuestionKind;
  sourceType: QuestionSourceType;
  sourceName: string | null;
  categoryId: number;
  categoryPath: string[];
  area: string | null;
  listening: boolean;
  difficulty: QuestionDifficulty;
  question: string;
  passage?: string | null;
  choices: string[];
  answer: string;
  explanation: string;
  keywords: string[];
  embeddingText: string;
  embeddingStatus: EmbeddingStatus;
  embeddingModel: string | null;
  embeddedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PageResponse<T> = {
  content: T[];
  totalElements: number;
  totalPages: number;
  size: number;
  number: number;
};

type EmbeddingBatchResult = {
  picked: number;
  completed: number;
  failed: number;
  stillPending: number;
};

type RoleSummary = {
  id: number;
  code: string;
  name: string;
};

type UserSummary = {
  id: number;
  email: string;
  username: string;
  role: RoleSummary;
  permissions: string[];
};

type TokenResponse = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSec: number;
  user: UserSummary;
};

type WebMenuId = "englishConversation" | "questionMgmt" | "questionGen" | "admin";

type WebMenu = {
  id: WebMenuId;
  label: string;
  subtitle: string;
  icon: LucideIcon;
  children?: string[];
};

const FALLBACK_AGENTS: Agent[] = [
  {
    id: "debate",
    title: "미국 친구",
    subtitle: "American Friend",
    description: "일상 회화와 짧은 영어 답변을 편하게 연습합니다.",
    sessionGoal: "오늘 있었던 일이나 관심사를 영어로 말하기",
  },
  {
    id: "interview",
    title: "면접 코치",
    subtitle: "Interview Coach",
    description: "답변을 짧고 명확한 영어로 정리합니다.",
    sessionGoal: "자기소개와 경험 설명 연습",
  },
  {
    id: "travel",
    title: "여행 도우미",
    subtitle: "Travel Buddy",
    description: "공항, 호텔, 식당에서 바로 쓰는 표현을 연습합니다.",
    sessionGoal: "여행 상황별 말하기",
  },
];

const starterPrompts = [
  "How was your day?",
  "What do you usually do on weekends?",
  "Tell me about life in the U.S.",
];

const defaultApiUrl = "http://localhost:3301";
const appVersion = "0.1.0";

const QUESTION_DIFFICULTY_OPTIONS: SelectOption<QuestionDifficulty | "">[] = [
  { value: "", label: "전체 난이도" },
  { value: "easy", label: "하" },
  { value: "medium", label: "중" },
  { value: "hard", label: "상" },
];

const WEB_HEADER_MENUS: WebMenu[] = [
  {
    id: "englishConversation",
    label: "영어 회화",
    subtitle: "AI 회화 · 표현 피드백",
    icon: MessagesSquare,
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

function canAccessMenu(user: UserSummary | null, menu: WebMenuId) {
  if (menu === "englishConversation") return true;
  return user?.role.code === "ROLE_ADMIN";
}

function createId() {
  return crypto.randomUUID();
}

function normalizeReply(text: string) {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/gi, "$1 degrees Celsius")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

function hasKorean(text: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

function buildCategoryTree(flat: CategoryRecord[]): CategoryNode[] {
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
}

function findCategoryNode(nodes: CategoryNode[], id: number | null): CategoryNode | null {
  if (id === null) return null;
  for (const node of nodes) {
    if (node.id === id) return node;
    const child = findCategoryNode(node.children, id);
    if (child) return child;
  }
  return null;
}

function flattenCategoryTree(nodes: CategoryNode[], depth = 0): Array<CategoryNode & { depth: number }> {
  return nodes.flatMap((node) => [
    { ...node, depth },
    ...flattenCategoryTree(node.children, depth + 1),
  ]);
}

function difficultyLabel(value: QuestionDifficulty) {
  return { easy: "하", medium: "중", hard: "상" }[value];
}

function embeddingLabel(value: EmbeddingStatus) {
  return { PENDING: "임베딩 대기", COMPLETED: "완료", FAILED: "실패" }[value];
}

function questionKindLabel(value: QuestionKind | null | undefined) {
  const labels: Record<QuestionKind, string> = {
    GENERAL: "일반",
    LISTENING_PURPOSE_OPINION: "목적/의견",
    LISTENING_RELATION_PLACE: "관계/장소",
    LISTENING_VISUAL_CHART: "그림/도표",
    LISTENING_TASK_REASON: "할 일/이유",
    LISTENING_DETAIL: "내용 일치",
    LISTENING_LONG_TALK: "긴 대화/담화",
    MAIN_IDEA: "대의 파악",
    PURPOSE: "목적",
    CLAIM: "주장",
    GIST: "요지",
    TOPIC: "주제",
    TITLE: "제목",
    DETAIL_CHART: "도표",
    DETAIL_MATCH: "내용 일치",
    PRACTICAL_TEXT: "실용문",
    VOCAB_CONTEXT: "문맥상 어휘",
    VOCAB_UNDERLINED: "밑줄 어휘",
    GRAMMAR_CHECK: "어법성 판단",
    BLANK_WORD: "단어 빈칸",
    BLANK_PHRASE: "구/절 빈칸",
    BLANK_SENTENCE: "문장 빈칸",
    IRRELEVANT_SENTENCE: "무관한 문장",
    ORDERING: "글의 순서",
    SENTENCE_INSERTION: "문장 삽입",
    SUMMARY_COMPLETION: "요약문 완성",
    LONG_READING_SET: "1지문 2문항",
    COMPOSITE_READING: "복합 장문",
  };
  return labels[value ?? "GENERAL"];
}

function sourceLabel(type: QuestionSourceType | null | undefined, name?: string | null) {
  const labels: Record<QuestionSourceType, string> = {
    UNKNOWN: "출처 미상",
    CSAT: "수능",
    MOCK: "모의고사",
    CUSTOM: "자체 제작",
  };
  const base = labels[type ?? "UNKNOWN"];
  return name ? `${base} · ${name}` : base;
}

async function readImage(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(reader.result);
      else reject(new Error("이미지를 읽지 못했습니다."));
    };
    reader.onerror = () => reject(reader.error ?? new Error("이미지를 읽지 못했습니다."));
    reader.readAsDataURL(file);
  });
}

async function apiFetch(input: string, init?: RequestInit) {
  return tauriFetch(input, init);
}

function LoginScreen({
  onLogin,
}: {
  onLogin: (email: string, password: string) => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");

  const submitLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    setLoginError("");
    try {
      await onLogin(email.trim(), password);
      if (remember) localStorage.setItem("aegis:login-email", email.trim());
      else localStorage.removeItem("aegis:login-email");
    } catch (caught) {
      setLoginError(caught instanceof Error ? caught.message : "로그인에 실패했습니다.");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    setEmail(localStorage.getItem("aegis:login-email") || "");
  }, []);

  return (
    <main className="login-screen">
      <div className="login-shell-brand">
        <div className="login-shell-mark">
          <Bot size={17} />
        </div>
        <span>AEGIS</span>
      </div>
      <section className="login-card">
        <div className="login-card-header">
          <div className="login-mark">
            <Bot size={24} />
          </div>
          <div>
            <h1>AEGIS English</h1>
            <p>계정으로 로그인해 학습 도구를 시작하세요.</p>
          </div>
        </div>

        <form className="login-form" onSubmit={submitLogin}>
          <label>
            이메일
            <input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="terecal@daum.net"
              type="email"
              autoComplete="email"
            />
          </label>

          <label>
            비밀번호
            <span className="password-field">
              <input
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="비밀번호"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
              />
              <button type="button" onClick={() => setShowPassword((value) => !value)} title="비밀번호 표시 전환">
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </span>
          </label>

          <div className="login-options">
            <label className="remember-row">
              <input
                checked={remember}
                onChange={(event) => setRemember(event.target.checked)}
                type="checkbox"
              />
              이메일 기억하기
            </label>
          </div>

          {loginError && <div className="login-error">{loginError}</div>}

          <button className="login-submit" disabled={submitting || !email.trim() || !password} type="submit">
            {submitting ? <Loader2 className="spin" size={18} /> : <LogIn size={18} />}
            로그인
          </button>
        </form>
      </section>
    </main>
  );
}

export function App() {
  const apiUrl = defaultApiUrl;
  const [token, setToken] = useState(() => localStorage.getItem("aegis:access-token") || "");
  const [refreshToken, setRefreshToken] = useState(() => localStorage.getItem("aegis:refresh-token") || "");
  const [user, setUser] = useState<UserSummary | null>(() => {
    const raw = localStorage.getItem("aegis:user");
    if (!raw) return null;
    try {
      return JSON.parse(raw) as UserSummary;
    } catch {
      return null;
    }
  });
  const [agents, setAgents] = useState<Agent[]>(FALLBACK_AGENTS);
  const [selectedAgentId, setSelectedAgentId] = useState("debate");
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [image, setImage] = useState<{ name: string; dataUrl: string } | null>(null);
  const [sending, setSending] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"checking" | "online" | "offline">("checking");
  const [autoTranslate, setAutoTranslate] = useState(true);
  const [responseLength, setResponseLength] = useState<"1-3" | "3-4" | "4-5">("1-3");
  const [sidebarTab, setSidebarTab] = useState<"koen" | "history" | "feedback">("koen");
  const [draftKo, setDraftKo] = useState("");
  const [feedback, setFeedback] = useState<string[]>([]);
  const [history, setHistory] = useState<Message[][]>([]);
  const [error, setError] = useState("");
  const [activeMenu, setActiveMenu] = useState<WebMenuId>("englishConversation");
  const [subjects, setSubjects] = useState<CategoryNode[]>([]);
  const [questionBankLoading, setQuestionBankLoading] = useState(false);
  const [questionBankError, setQuestionBankError] = useState("");
  const [questionBankReloadKey, setQuestionBankReloadKey] = useState(0);
  const [selectedSubjectId, setSelectedSubjectId] = useState<number | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [questionDifficulty, setQuestionDifficulty] = useState<QuestionDifficulty | "">("");
  const [questionKeyword, setQuestionKeyword] = useState("");
  const [questions, setQuestions] = useState<QuestionResponse[]>([]);
  const [questionsLoading, setQuestionsLoading] = useState(false);
  const [questionsError, setQuestionsError] = useState("");
  const [questionReloadKey, setQuestionReloadKey] = useState(0);
  const [questionActionBusy, setQuestionActionBusy] = useState("");
  const [selectedEmbeddingStatus, setSelectedEmbeddingStatus] = useState<EmbeddingStatusResponse>({
    pending: 0,
    completed: 0,
    failed: 0,
  });
  const [embeddingStatus, setEmbeddingStatus] = useState<EmbeddingStatusResponse>({
    pending: 0,
    completed: 0,
    failed: 0,
  });
  const fileRef = useRef<HTMLInputElement | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);

  const selectedAgent = useMemo(
    () => agents.find((agent) => agent.id === selectedAgentId) ?? agents[0] ?? FALLBACK_AGENTS[0],
    [agents, selectedAgentId]
  );
  const activeWebMenu = useMemo(
    () => WEB_HEADER_MENUS.find((menu) => menu.id === activeMenu) ?? WEB_HEADER_MENUS[0],
    [activeMenu]
  );
  const ActiveWebMenuIcon = activeWebMenu.icon;
  const isLoggedIn = token.trim().length > 0 && user !== null;
  const canAccessActiveMenu = canAccessMenu(user, activeMenu);
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );

  useEffect(() => {
    if (token.trim()) localStorage.setItem("aegis:access-token", token.trim());
    else localStorage.removeItem("aegis:access-token");
  }, [token]);

  useEffect(() => {
    if (refreshToken.trim()) localStorage.setItem("aegis:refresh-token", refreshToken.trim());
    else localStorage.removeItem("aegis:refresh-token");
  }, [refreshToken]);

  useEffect(() => {
    if (user) localStorage.setItem("aegis:user", JSON.stringify(user));
    else localStorage.removeItem("aegis:user");
  }, [user]);

  useEffect(() => {
    if (!isLoggedIn) {
      setAgents(FALLBACK_AGENTS);
      return;
    }

    let cancelled = false;
    setConnectionStatus("checking");
    apiFetch(`${apiUrl}/api/agents`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(async (response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return (await response.json()) as Agent[];
      })
      .then((data) => {
        if (cancelled) return;
        if (data.length > 0) {
          setAgents(data);
          setSelectedAgentId((current) => data.some((agent) => agent.id === current) ? current : data[0].id);
        }
        setConnectionStatus("online");
        setError("");
      })
      .catch(() => {
        if (cancelled) return;
        setConnectionStatus("offline");
        setAgents(FALLBACK_AGENTS);
      });
    return () => {
      cancelled = true;
    };
  }, [apiUrl, isLoggedIn, token]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    if (activeMenu !== "questionMgmt" || !canAccessActiveMenu) return;
    let cancelled = false;
    setQuestionBankLoading(true);
    setQuestionBankError("");

    const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    Promise.all([
      apiFetch(`${apiUrl}/api/question-categories`, { headers }).then(async (response) => {
        if (!response.ok) throw new Error(`categories HTTP ${response.status}`);
        return (await response.json()) as CategoryRecord[];
      }),
      apiFetch(`${apiUrl}/api/questions/embedding-status`, { headers }).then(async (response) => {
        if (!response.ok) throw new Error(`embedding HTTP ${response.status}`);
        return (await response.json()) as EmbeddingStatusResponse;
      }),
    ])
      .then(([categories, status]) => {
        if (cancelled) return;
        setSubjects(buildCategoryTree(categories));
        setEmbeddingStatus(status);
      })
      .catch((caught) => {
        if (cancelled) return;
        setSubjects([]);
        setEmbeddingStatus({ pending: 0, completed: 0, failed: 0 });
        setQuestionBankError(caught instanceof Error ? caught.message : "문제 은행 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setQuestionBankLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMenu, apiUrl, canAccessActiveMenu, questionBankReloadKey, token]);

  useEffect(() => {
    if (selectedSubjectId === null) return;
    if (!subjects.some((subject) => subject.id === selectedSubjectId)) {
      setSelectedSubjectId(null);
      setSelectedCategoryId(null);
    }
  }, [selectedSubjectId, subjects]);

  useEffect(() => {
    if (activeMenu !== "questionMgmt" || !canAccessActiveMenu || !selectedSubject) {
      setQuestions([]);
      setSelectedEmbeddingStatus({ pending: 0, completed: 0, failed: 0 });
      return;
    }

    let cancelled = false;
    setQuestionsLoading(true);
    setQuestionsError("");
    const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    const categoryId = selectedCategoryId ?? selectedSubject.id;
    const params = new URLSearchParams({
      categoryId: String(categoryId),
      size: "100",
      sort: "createdAt,desc",
    });
    if (questionDifficulty) params.set("difficulty", questionDifficulty);
    if (questionKeyword.trim()) params.set("keyword", questionKeyword.trim());

    Promise.all([
      apiFetch(`${apiUrl}/api/questions?${params.toString()}`, { headers }).then(async (response) => {
        if (!response.ok) throw new Error(`questions HTTP ${response.status}`);
        const data = (await response.json()) as PageResponse<QuestionResponse> | QuestionResponse[];
        return Array.isArray(data) ? data : data.content;
      }),
      apiFetch(`${apiUrl}/api/questions/embedding-status?categoryId=${selectedSubject.id}`, { headers }).then(async (response) => {
        if (!response.ok) throw new Error(`embedding HTTP ${response.status}`);
        return (await response.json()) as EmbeddingStatusResponse;
      }),
    ])
      .then(([items, status]) => {
        if (cancelled) return;
        setQuestions(items);
        setSelectedEmbeddingStatus(status);
      })
      .catch((caught) => {
        if (cancelled) return;
        setQuestions([]);
        setSelectedEmbeddingStatus({ pending: 0, completed: 0, failed: 0 });
        setQuestionsError(caught instanceof Error ? caught.message : "문제 목록을 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setQuestionsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    activeMenu,
    apiUrl,
    canAccessActiveMenu,
    questionDifficulty,
    questionKeyword,
    questionReloadKey,
    selectedCategoryId,
    selectedSubject,
    token,
  ]);

  const sendMessage = async (event?: FormEvent) => {
    event?.preventDefault();
    const text = input.trim();
    if ((!text && !image) || sending) return;

    const learnerMessage: Message = {
      id: createId(),
      role: "learner",
      text: text || "Please look at this image.",
      imageUrl: image?.dataUrl,
    };
    const agentMessageId = createId();
    const historyTurns: ChatTurn[] = messages.slice(-12).map((message) => ({
      role: message.role === "agent" ? "assistant" : "user",
      content: message.text,
    }));

    setMessages((current) => [
      ...current,
      learnerMessage,
      { id: agentMessageId, role: "agent", text: "", streaming: true },
    ]);
    setInput("");
    setImage(null);
    setSending(true);
    setError("");

    try {
      const body = {
        agentId: selectedAgent.id,
        message: text || "Please look at the attached image and respond naturally.",
        instructions: [
          `Keep replies to ${responseLength} sentences.`,
          "Write like natural spoken conversation. Avoid em dashes, double hyphens, markdown bullets, and decorative punctuation.",
          autoTranslate ? "If useful, keep English simple for a Korean learner." : "",
        ].filter(Boolean).join("\n"),
        history: historyTurns,
        images: image ? [{ dataUrl: image.dataUrl }] : undefined,
      };

      if (image) {
        const response = await apiFetch(`${apiUrl}/api/ai/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = (await response.json()) as { content: string };
        const reply = normalizeReply(data.content);
        setMessages((current) =>
          current.map((message) =>
            message.id === agentMessageId ? { ...message, text: reply, streaming: false } : message
          )
        );
      } else {
        const response = await apiFetch(`${apiUrl}/api/ai/chat/stream`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify(body),
        });
        if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let responseText = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const events = buffer.split("\n\n");
          buffer = events.pop() ?? "";
          for (const rawEvent of events) {
            const data = rawEvent
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5))
              .join("\n");
            if (!data) continue;
            responseText += data;
            setMessages((current) =>
              current.map((message) =>
                message.id === agentMessageId ? { ...message, text: message.text + data } : message
              )
            );
          }
        }
        const reply = normalizeReply(responseText);
        setMessages((current) =>
          current.map((message) =>
            message.id === agentMessageId ? { ...message, text: reply, streaming: false } : message
          )
        );
      }
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "unknown error";
      setError(`백엔드 연결 또는 인증을 확인하세요. ${message}`);
      setMessages((current) =>
        current.map((item) =>
          item.id === agentMessageId
            ? {
                ...item,
                streaming: false,
                text: "I could not connect to the English Agent Hub server. Please check the backend server and your login session.",
              }
            : item
        )
      );
    } finally {
      setSending(false);
    }
  };

  const saveSession = () => {
    if (messages.length === 0) return;
    setHistory((current) => [messages, ...current].slice(0, 8));
  };

  const buildFeedback = () => {
    const source = draftKo.trim() || input.trim();
    if (!source) return;
    setSidebarTab("feedback");
    if (hasKorean(source)) {
      setFeedback([
        "Could you say that again in a simpler way?",
        "What do you mean by that?",
        "I want to explain it more naturally in English.",
      ]);
    } else {
      setFeedback([
        source.replace(/\s*[—–]\s*/g, ", "),
        "That sounds natural. You can say it a little more casually.",
        "Try making it shorter for conversation.",
      ]);
    }
  };

  const refreshQuestions = () => {
    setQuestionReloadKey((value) => value + 1);
  };

  const refreshQuestionBank = () => {
    setQuestionBankReloadKey((value) => value + 1);
    refreshQuestions();
  };

  const openMenu = (menu: WebMenuId) => {
    setActiveMenu(menu);
  };

  const openSubject = (subjectId: number) => {
    setSelectedSubjectId(subjectId);
    setSelectedCategoryId(null);
    setQuestionDifficulty("");
    setQuestionKeyword("");
  };

  const backToSubjects = () => {
    setSelectedSubjectId(null);
    setSelectedCategoryId(null);
    setQuestions([]);
    setQuestionsError("");
  };

  const embedQuestion = async (question: QuestionResponse) => {
    if (questionActionBusy) return;
    setQuestionActionBusy(`embed:${question.id}`);
    const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const response = await apiFetch(`${apiUrl}/api/questions/${question.id}/embed`, {
        method: "POST",
        headers,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      refreshQuestions();
    } catch (caught) {
      setQuestionsError(caught instanceof Error ? caught.message : "임베딩 요청에 실패했습니다.");
    } finally {
      setQuestionActionBusy("");
    }
  };

  const embedPendingQuestions = async () => {
    if (!selectedSubject || questionActionBusy) return;
    setQuestionActionBusy("embed-pending");
    const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const response = await apiFetch(
        `${apiUrl}/api/questions/embed-pending?categoryId=${selectedSubject.id}&limit=50`,
        { method: "POST", headers }
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      await response.json() as EmbeddingBatchResult;
      refreshQuestions();
    } catch (caught) {
      setQuestionsError(caught instanceof Error ? caught.message : "일괄 임베딩 요청에 실패했습니다.");
    } finally {
      setQuestionActionBusy("");
    }
  };

  const deleteQuestion = async (question: QuestionResponse) => {
    if (questionActionBusy) return;
    if (!window.confirm(`이 문제를 삭제할까요?\n\n${question.question}`)) return;
    setQuestionActionBusy(`delete:${question.id}`);
    const headers: HeadersInit | undefined = token ? { Authorization: `Bearer ${token}` } : undefined;
    try {
      const response = await apiFetch(`${apiUrl}/api/questions/${question.id}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      refreshQuestionBank();
    } catch (caught) {
      setQuestionsError(caught instanceof Error ? caught.message : "문제 삭제에 실패했습니다.");
    } finally {
      setQuestionActionBusy("");
    }
  };

  const handleLogin = async (email: string, password: string) => {
    let response: Response;
    try {
      response = await apiFetch(`${apiUrl}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      throw new Error("백엔드 서버가 실행 중인지 확인하세요.");
    }

    if (!response.ok) {
      let message = response.status === 401 ? "이메일 또는 비밀번호가 올바르지 않습니다." : `로그인 실패 (HTTP ${response.status})`;
      try {
        const data = (await response.json()) as { message?: string };
        if (data.message) message = data.message;
      } catch {
        // ignore invalid error body
      }
      throw new Error(message);
    }
    const data = (await response.json()) as TokenResponse;
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    setActiveMenu(canAccessMenu(data.user, "questionMgmt") ? "questionMgmt" : "englishConversation");
  };

  const handleLogout = async () => {
    if (token) {
      await apiFetch(`${apiUrl}/api/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => undefined);
    }
    setToken("");
    setRefreshToken("");
    setUser(null);
  };

  const attachImage = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
      setError("PNG, JPG, WebP, GIF 이미지만 첨부할 수 있습니다.");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("이미지는 5MB보다 작아야 합니다.");
      return;
    }
    setImage({ name: file.name, dataUrl: await readImage(file) });
    if (fileRef.current) fileRef.current.value = "";
  };

  if (!isLoggedIn) {
    return (
      <LoginScreen
        onLogin={handleLogin}
      />
    );
  }

  return (
    <main className="app-shell">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <button className="sidebar-brand-mark" onClick={() => openMenu("englishConversation")} title="영어 회화">
            <Bot size={19} />
          </button>
          <div>
            <strong>AEGIS</strong>
            <span>Desktop client</span>
          </div>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-kicker">Header menu</div>
          <nav className="sidebar-menu">
            {WEB_HEADER_MENUS.map((menu) => {
              const Icon = menu.icon;
              return (
                <button
                  key={menu.id}
                  className={activeMenu === menu.id ? "active" : ""}
                  onClick={() => openMenu(menu.id)}
                >
                  <Icon size={18} />
                  <span>
                    <strong>{menu.label}</strong>
                    <small>{menu.subtitle}</small>
                  </span>
                  {menu.children && <ChevronDown className="sidebar-menu-chevron" size={15} />}
                </button>
              );
            })}
          </nav>

          {activeWebMenu.children && (
            <div className="sidebar-submenu">
              {activeWebMenu.children.map((child) => (
                <button key={child}>{child}</button>
              ))}
            </div>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-version">AEGIS Desktop v{appVersion}</div>
          <div className="account-card">
            <div className="account-avatar">{user.username.slice(0, 2).toUpperCase()}</div>
            <div className="account-copy">
              <strong>{user.username}</strong>
              <span>{user.role.name || user.role.code}</span>
            </div>
            <div className={`account-status ${connectionStatus}`}>
              {connectionStatus === "checking" && <Loader2 className="spin" size={13} />}
              {connectionStatus === "online" && <CheckCircle2 size={13} />}
              {connectionStatus === "offline" && <CircleAlert size={13} />}
            </div>
          </div>
          <button className="auth-button" onClick={() => void handleLogout()}>
            <LogOut size={16} />
            로그아웃
          </button>
        </div>
      </aside>

      <div className="app-content">
        <header className="topbar">
          <div className="brand compact">
            <div className="brand-mark">
              <ActiveWebMenuIcon size={18} />
            </div>
            <div>
              <strong>{activeWebMenu.label}</strong>
              <span>
                {activeMenu === "englishConversation"
                  ? `${selectedAgent.title} · ${selectedAgent.sessionGoal || selectedAgent.description}`
                  : activeWebMenu.subtitle}
              </span>
            </div>
          </div>
        </header>

        {activeMenu === "englishConversation" && (
          <section className="workspace">
          <aside className="agents">
          <div className="panel-title">
            <strong>Agents</strong>
            <Settings2 size={16} />
          </div>
          <div className="agent-list">
            {agents.map((agent) => (
              <button
                key={agent.id}
                className={`agent-card ${selectedAgent.id === agent.id ? "active" : ""}`}
                onClick={() => setSelectedAgentId(agent.id)}
              >
                <span>{agent.title}</span>
                <small>{agent.subtitle || agent.description}</small>
              </button>
            ))}
          </div>

          <div className="settings-card">
            <p>
              <KeyRound size={13} /> {user.email}
            </p>
            <p>
              {connectionStatus === "online" ? <CheckCircle2 size={13} /> : <CircleAlert size={13} />}
              {connectionStatus === "online" ? "백엔드 서버에 연결되어 있습니다." : "백엔드 서버 연결을 확인하세요."}
            </p>
          </div>
          </aside>

          <section className="chat-panel">
          <div className="agent-header">
            <div>
              <h1>{selectedAgent.title}</h1>
              <p>{selectedAgent.sessionGoal || selectedAgent.description}</p>
            </div>
            <div className="controls">
              {(["1-3", "3-4", "4-5"] as const).map((length) => (
                <button
                  key={length}
                  className={responseLength === length ? "selected" : ""}
                  onClick={() => setResponseLength(length)}
                >
                  {length}
                </button>
              ))}
              <button
                className={autoTranslate ? "selected" : ""}
                onClick={() => setAutoTranslate((value) => !value)}
              >
                <Languages size={14} />
                한영
              </button>
            </div>
          </div>

          <div className="messages">
            {messages.length === 0 && (
              <div className="empty-state">
                <div className="empty-icon"><Bot size={26} /></div>
                <p>문장으로 시작하거나 이미지를 첨부해 대화를 시작하세요.</p>
                <div className="starter-row">
                  {starterPrompts.map((prompt) => (
                    <button key={prompt} onClick={() => setInput(prompt)}>{prompt}</button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <article key={message.id} className={`message ${message.role}`}>
                {message.imageUrl && <img className="message-image" src={message.imageUrl} alt="Attached" />}
                <p>{message.streaming && !message.text ? "Thinking..." : message.text}</p>
              </article>
            ))}
            <div ref={endRef} />
          </div>

          <form className="composer" onSubmit={sendMessage}>
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => void attachImage(event.target.files)} />
            <div className="quick-actions">
              <button type="button" onClick={() => setInput("Can you help me say this naturally in English?")}>
                <WandSparkles size={15} />
                추천 답변
              </button>
              <button type="button" onClick={() => fileRef.current?.click()}>
                <ImageIcon size={15} />
                이미지
              </button>
              <button type="button" onClick={() => setInput("Let's talk about something casual from daily life.")}>
                <Paperclip size={15} />
                가벼운 대화
              </button>
            </div>

            {image && (
              <div className="attached-image">
                <img src={image.dataUrl} alt={image.name} />
                <span>{image.name}</span>
                <button type="button" onClick={() => setImage(null)}>삭제</button>
              </div>
            )}

            {error && <div className="error">{error}</div>}

            <div className="input-row">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="영어나 한국어로 편하게 답변해보세요."
                rows={3}
              />
              <div className="send-stack">
                <button type="button" className="icon-button" title="음성 입력 자리">
                  <Mic size={18} />
                </button>
                <button type="submit" className="send-button" disabled={sending || (!input.trim() && !image)}>
                  {sending ? <Loader2 className="spin" size={18} /> : <Send size={18} />}
                  전송
                </button>
              </div>
            </div>
          </form>
          </section>

          <aside className="learning-tools">
          <h2>학습 도구</h2>
          <div className="tabs">
            {[
              ["koen", "한영 모드"],
              ["history", "히스토리"],
              ["feedback", "피드백"],
            ].map(([key, label]) => (
              <button
                key={key}
                className={sidebarTab === key ? "active" : ""}
                onClick={() => setSidebarTab(key as "koen" | "history" | "feedback")}
              >
                {label}
              </button>
            ))}
          </div>

          {sidebarTab === "koen" && (
            <section className="tool-body">
              <label className="draft-label">Draft</label>
              <textarea
                value={draftKo}
                onChange={(event) => setDraftKo(event.target.value)}
                placeholder="한국어로 먼저 말하고 싶은 내용을 적어보세요."
                rows={7}
              />
              <div className="tool-actions">
                <button onClick={buildFeedback}><Sparkles size={15} /> 표현 확인</button>
                <button><Mic size={15} /> 음성 입력</button>
              </div>
            </section>
          )}

          {sidebarTab === "history" && (
            <section className="tool-body history-list">
              <button className="save-session" onClick={saveSession} disabled={messages.length === 0}>
                <Save size={15} />
                현재 대화 저장
              </button>
              {history.length === 0 ? (
                <p className="muted">저장된 대화가 없습니다.</p>
              ) : history.map((session, index) => (
                <button key={index} onClick={() => setMessages(session)}>
                  <HistoryIcon size={15} />
                  <span>{session[0]?.text.slice(0, 42) || "Saved conversation"}</span>
                </button>
              ))}
            </section>
          )}

          {sidebarTab === "feedback" && (
            <section className="tool-body feedback-list">
              {feedback.length === 0 ? (
                <p className="muted">한영 모드에서 표현 확인을 누르면 추천 표현이 여기에 표시됩니다.</p>
              ) : feedback.map((item) => (
                <div className="feedback-item" key={item}>
                  <p>{item}</p>
                  <button onClick={() => setInput(item)}><Send size={14} /> 바로 입력</button>
                  <button><Volume2 size={14} /> 듣기</button>
                </div>
              ))}
            </section>
          )}
          </aside>
          </section>
        )}

        {activeMenu === "questionMgmt" && (
          canAccessActiveMenu ? (
            <QuestionManagementView
              subjects={subjects}
              selectedSubject={selectedSubject}
              selectedCategoryId={selectedCategoryId}
              questionDifficulty={questionDifficulty}
              questionKeyword={questionKeyword}
              questions={questions}
              questionsLoading={questionsLoading}
              questionsError={questionsError}
              questionActionBusy={questionActionBusy}
              embeddingStatus={embeddingStatus}
              selectedEmbeddingStatus={selectedEmbeddingStatus}
              loading={questionBankLoading}
              error={questionBankError}
              isLoggedIn={isLoggedIn}
              onOpenSubject={openSubject}
              onBackToSubjects={backToSubjects}
              onSelectCategory={setSelectedCategoryId}
              onSetDifficulty={setQuestionDifficulty}
              onSetKeyword={setQuestionKeyword}
              onRefresh={refreshQuestionBank}
              onRefreshQuestions={refreshQuestions}
              onEmbedQuestion={(question) => void embedQuestion(question)}
              onEmbedPending={() => void embedPendingQuestions()}
              onDeleteQuestion={(question) => void deleteQuestion(question)}
            />
          ) : (
            <ForbiddenView menu={activeWebMenu} />
          )
        )}

        {activeMenu !== "englishConversation" && activeMenu !== "questionMgmt" && (
          canAccessActiveMenu ? (
            <FeaturePlaceholder menu={activeWebMenu} isLoggedIn={isLoggedIn} />
          ) : (
            <ForbiddenView menu={activeWebMenu} />
          )
        )}
      </div>
    </main>
  );
}

function ForbiddenView({ menu }: { menu: WebMenu }) {
  const Icon = menu.icon;
  return (
    <section className="feature-placeholder">
      <div className="feature-placeholder-box">
        <div className="empty-icon warning">
          <CircleAlert size={26} />
        </div>
        <h1>{menu.label}</h1>
        <p>이 메뉴는 관리자 권한이 필요합니다. 일반 계정은 영어 회화 기능만 사용할 수 있습니다.</p>
        <span>
          <Icon size={15} />
          {menu.subtitle}
        </span>
      </div>
    </section>
  );
}

function QuestionManagementView({
  subjects,
  selectedSubject,
  selectedCategoryId,
  questionDifficulty,
  questionKeyword,
  questions,
  questionsLoading,
  questionsError,
  questionActionBusy,
  embeddingStatus,
  selectedEmbeddingStatus,
  loading,
  error,
  isLoggedIn,
  onOpenSubject,
  onBackToSubjects,
  onSelectCategory,
  onSetDifficulty,
  onSetKeyword,
  onRefresh,
  onRefreshQuestions,
  onEmbedQuestion,
  onEmbedPending,
  onDeleteQuestion,
}: {
  subjects: CategoryNode[];
  selectedSubject: CategoryNode | null;
  selectedCategoryId: number | null;
  questionDifficulty: QuestionDifficulty | "";
  questionKeyword: string;
  questions: QuestionResponse[];
  questionsLoading: boolean;
  questionsError: string;
  questionActionBusy: string;
  embeddingStatus: EmbeddingStatusResponse;
  selectedEmbeddingStatus: EmbeddingStatusResponse;
  loading: boolean;
  error: string;
  isLoggedIn: boolean;
  onOpenSubject: (subjectId: number) => void;
  onBackToSubjects: () => void;
  onSelectCategory: (categoryId: number | null) => void;
  onSetDifficulty: (difficulty: QuestionDifficulty | "") => void;
  onSetKeyword: (keyword: string) => void;
  onRefresh: () => void;
  onRefreshQuestions: () => void;
  onEmbedQuestion: (question: QuestionResponse) => void;
  onEmbedPending: () => void;
  onDeleteQuestion: (question: QuestionResponse) => void;
}) {
  const categoryOptions = selectedSubject ? flattenCategoryTree([selectedSubject]) : [];
  const activeCategory = selectedCategoryId ? findCategoryNode(subjects, selectedCategoryId) : selectedSubject;
  const visibleEmbeddingStatus = selectedSubject ? selectedEmbeddingStatus : embeddingStatus;

  return (
    <section className="question-bank-view">
      <div className="question-bank-inner">
        <header className="question-bank-hero">
          <div>
            <div className="page-eyebrow">
              <BookOpenCheck size={16} />
              {selectedSubject ? "Question Bank Workspace" : "Question Bank PoC"}
            </div>
            <h1>{selectedSubject ? `${selectedSubject.name} 문제 은행` : "문제 은행"}</h1>
            <p>
              {selectedSubject
                ? `${activeCategory?.name ?? selectedSubject.name} 분류의 문제를 조회하고 임베딩 상태를 관리합니다.`
                : "과목을 선택해 분류 트리와 문제를 관리합니다. 과목은 카테고리 트리의 최상위 노드입니다."}
            </p>
          </div>
          <div className="embedding-summary">
            <EmbeddingCountCard kind="PENDING" count={visibleEmbeddingStatus.pending} />
            <EmbeddingCountCard kind="COMPLETED" count={visibleEmbeddingStatus.completed} />
            <EmbeddingCountCard kind="FAILED" count={visibleEmbeddingStatus.failed} />
          </div>
        </header>

        {!selectedSubject ? (
          <section className="subject-section">
          <div className="subject-toolbar">
            <h2>과목 ({subjects.length})</h2>
            <button type="button" disabled={!isLoggedIn} onClick={onRefresh}>
              <RefreshCw size={16} />
              새로고침
            </button>
            <button type="button" disabled>
              <FolderPlus size={16} />
              과목 추가
            </button>
          </div>

          {loading ? (
            <div className="question-empty">
              <Loader2 className="spin" size={22} />
              <span>문제 은행 데이터를 불러오는 중</span>
            </div>
          ) : error ? (
            <div className="question-empty warning">
              <CircleAlert size={22} />
              <strong>문제 은행 데이터를 불러오지 못했습니다.</strong>
              <span>{error}</span>
            </div>
          ) : subjects.length === 0 ? (
            <div className="question-empty">
              <BookOpenCheck size={28} />
              <strong>아직 과목이 없습니다.</strong>
              <span>{isLoggedIn ? "우측 상단 버튼으로 첫 과목을 추가하세요." : "로그인 토큰을 입력하면 과목 관리 기능을 사용할 수 있습니다."}</span>
            </div>
          ) : (
            <div className="subject-grid">
              {subjects.map((subject, index) => (
                <SubjectCard key={subject.id} subject={subject} index={index} onOpen={onOpenSubject} />
              ))}
            </div>
          )}
          </section>
        ) : (
          <section className="question-workspace">
            <div className="question-workspace-top">
              <button type="button" className="soft-action" onClick={onBackToSubjects}>
                <ArrowLeft size={16} />
                과목 목록
              </button>
              <div className="question-workspace-actions">
                <button type="button" className="soft-action" onClick={onRefreshQuestions}>
                  <RefreshCw size={16} />
                  새로고침
                </button>
                <button
                  type="button"
                  className="dark-action"
                  disabled={questionActionBusy === "embed-pending"}
                  onClick={onEmbedPending}
                >
                  {questionActionBusy === "embed-pending" ? <Loader2 className="spin" size={16} /> : <Sparkles size={16} />}
                  대기 임베딩
                </button>
                <button type="button" className="dark-action" disabled>
                  <FolderPlus size={16} />
                  문제 등록
                </button>
              </div>
            </div>

            <div className="question-manager-grid">
              <aside className="category-browser">
                <div className="category-browser-title">
                  <strong>분류</strong>
                  <span>{selectedSubject.subtreeCount}</span>
                </div>
                <button
                  type="button"
                  className={selectedCategoryId === null ? "active" : ""}
                  onClick={() => onSelectCategory(null)}
                >
                  <span>전체</span>
                  <small>{selectedSubject.subtreeCount}</small>
                </button>
                {categoryOptions.slice(1).map((category) => (
                  <button
                    key={category.id}
                    type="button"
                    className={selectedCategoryId === category.id ? "active" : ""}
                    style={{ paddingLeft: 14 + category.depth * 14 }}
                    onClick={() => onSelectCategory(category.id)}
                  >
                    <span>{category.name}</span>
                    <small>{category.subtreeCount}</small>
                  </button>
                ))}
              </aside>

              <section className="question-list-panel">
                <div className="question-filterbar">
                  <Select
                    ariaLabel="난이도 필터"
                    className="question-filter-select"
                    options={QUESTION_DIFFICULTY_OPTIONS}
                    value={questionDifficulty}
                    onChange={onSetDifficulty}
                  />
                  <label className="question-search">
                    <Search size={16} />
                    <input
                      value={questionKeyword}
                      onChange={(event) => onSetKeyword(event.target.value)}
                      placeholder="문제/지문/정답/해설 검색"
                    />
                  </label>
                </div>

                {questionsLoading ? (
                  <div className="question-empty">
                    <Loader2 className="spin" size={22} />
                    <span>문제 목록을 불러오는 중</span>
                  </div>
                ) : questionsError ? (
                  <div className="question-empty warning">
                    <CircleAlert size={22} />
                    <strong>문제 목록을 불러오지 못했습니다.</strong>
                    <span>{questionsError}</span>
                  </div>
                ) : questions.length === 0 ? (
                  <div className="question-empty">
                    <BookOpenCheck size={28} />
                    <strong>표시할 문제가 없습니다.</strong>
                    <span>분류나 검색 조건을 바꿔보세요.</span>
                  </div>
                ) : (
                  <div className="question-card-list">
                    {questions.map((question) => (
                      <QuestionCard
                        key={question.id}
                        question={question}
                        busy={questionActionBusy}
                        onEmbed={onEmbedQuestion}
                        onDelete={onDeleteQuestion}
                      />
                    ))}
                  </div>
                )}
              </section>
            </div>
          </section>
        )}
      </div>
    </section>
  );
}

function SubjectCard({
  subject,
  index,
  onOpen,
}: {
  subject: CategoryNode;
  index: number;
  onOpen: (subjectId: number) => void;
}) {
  const tones = ["sky", "amber", "emerald", "violet", "rose"];
  const tone = tones[index % tones.length];

  return (
    <button type="button" className="subject-card" onClick={() => onOpen(subject.id)}>
      <span className={`subject-badge ${tone}`}>{subject.name}</span>
      <div className="subject-card-body">
        <div>
          <strong>{subject.subtreeCount}</strong>
          <span>문제 · 하위 분류 {subject.children.length}개</span>
        </div>
        <span className="subject-manage">
          관리
          <ChevronRight size={16} />
        </span>
      </div>
    </button>
  );
}

function QuestionCard({
  question,
  busy,
  onEmbed,
  onDelete,
}: {
  question: QuestionResponse;
  busy: string;
  onEmbed: (question: QuestionResponse) => void;
  onDelete: (question: QuestionResponse) => void;
}) {
  const correctChoice = question.choices.find((choice) => choice === question.answer);
  return (
    <article className={`question-admin-card ${question.embeddingStatus.toLowerCase()}`}>
      <div className="question-admin-head">
        <div className="question-badges">
          <span>{question.categoryPath.slice(1).join(" > ") || "전체"}</span>
          <span className="kind">{questionKindLabel(question.questionKind)}</span>
          <span>{difficultyLabel(question.difficulty)}</span>
          <span className="source">{sourceLabel(question.sourceType, question.sourceName)}</span>
          <span className={question.embeddingStatus.toLowerCase()}>{embeddingLabel(question.embeddingStatus)}</span>
        </div>
        <div className="question-card-actions">
          <button
            type="button"
            disabled={busy === `embed:${question.id}`}
            onClick={() => onEmbed(question)}
          >
            {busy === `embed:${question.id}` ? <Loader2 className="spin" size={15} /> : <Sparkles size={15} />}
            임베딩
          </button>
          <button
            type="button"
            className="danger"
            disabled={busy === `delete:${question.id}`}
            onClick={() => onDelete(question)}
          >
            {busy === `delete:${question.id}` ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
          </button>
        </div>
      </div>

      <h3>{question.question}</h3>
      {question.passage && <p className="question-passage">{question.passage}</p>}

      {question.choices.length > 0 && (
        <div className="choice-grid">
          {question.choices.map((choice, index) => (
            <div key={`${question.id}-${choice}-${index}`} className={choice === correctChoice ? "correct" : ""}>
              {choice === correctChoice && <CheckCircle2 size={14} />}
              <span>{index + 1}. {choice}</span>
            </div>
          ))}
        </div>
      )}

      <div className="question-detail-grid">
        <div>
          <strong>정답</strong>
          <span>{question.answer}</span>
        </div>
        <div>
          <strong>키워드</strong>
          <span>{question.keywords.length > 0 ? question.keywords.join(", ") : "-"}</span>
        </div>
      </div>
      {question.explanation && (
        <div className="question-explanation">
          <strong>해설</strong>
          <span>{question.explanation}</span>
        </div>
      )}
    </article>
  );
}

function EmbeddingCountCard({
  kind,
  count,
}: {
  kind: "PENDING" | "COMPLETED" | "FAILED";
  count: number;
}) {
  const meta = {
    PENDING: { label: "대기", className: "pending", Icon: Clock },
    COMPLETED: { label: "완료", className: "completed", Icon: CheckCircle2 },
    FAILED: { label: "실패", className: "failed", Icon: CircleAlert },
  }[kind];
  const Icon = meta.Icon;

  return (
    <div className={`embedding-card ${meta.className}`}>
      <Icon size={14} />
      <span>{meta.label}</span>
      <strong>{count}</strong>
    </div>
  );
}

function FeaturePlaceholder({ menu, isLoggedIn }: { menu: WebMenu; isLoggedIn: boolean }) {
  const Icon = menu.icon;

  return (
    <section className="feature-placeholder">
      <div className="feature-placeholder-box">
        <div className="empty-icon">
          <Icon size={26} />
        </div>
        <h1>{menu.label}</h1>
        <p>{menu.subtitle}</p>
        <span>{isLoggedIn ? "데스크톱 화면 연결 준비 중입니다." : "로그인 토큰을 입력하면 백엔드 연동 기능을 사용할 수 있습니다."}</span>
      </div>
    </section>
  );
}
