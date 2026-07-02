import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { canAccessMenu, WEB_HEADER_MENUS, type WebMenu, type WebMenuId } from "./model/navigation";
import type { Agent } from "../entities/agent/model/types";
import { fetchAgents } from "../entities/agent/api/agentApi";
import { FALLBACK_AGENTS, starterPrompts } from "../entities/agent/model/defaultAgents";
import { sendChat, streamChat } from "../entities/chat/api/chatApi";
import type { ChatTurn, Message } from "../entities/chat/model/types";
import {
  fetchAttemptResult,
  fetchPracticeDashboard,
  startExamAttempt,
  submitAttemptAnswers,
} from "../entities/exam/api/practiceApi";
import type {
  AttemptResultResponse,
  AttemptSummaryResponse,
  ExamResponse,
  ExamTakeResponse,
} from "../entities/exam/model/types";
import {
  fetchQuestionBank,
  fetchQuestionsByCategory,
  removeQuestion,
  requestPendingQuestionEmbeddings,
  requestQuestionEmbedding,
} from "../entities/question/api/questionApi";
import type {
  CategoryNode,
  EmbeddingStatusResponse,
  QuestionDifficulty,
  QuestionResponse,
} from "../entities/question/model/types";
import { buildCategoryTree } from "../entities/question/lib/categoryTree";
import { defaultApiUrl } from "../shared/api/client";
import { EnglishConversationView } from "../pages/english-conversation/ui/EnglishConversationView";
import { PracticeView } from "../pages/practice/ui/PracticeView";
import { QuestionManagementView } from "../pages/question-bank/ui/QuestionManagementView";
import { readImage } from "../shared/lib/file";
import { hasKorean, normalizeReply } from "../shared/lib/format";
import { CircleAlert } from "lucide-react";
import { login, logout } from "../features/auth/api/authApi";
import { LoginScreen } from "../features/auth/login/LoginScreen";
import { useAuthSession } from "../features/auth/model/useAuthSession";
import { AppSidebar } from "../widgets/app-shell/ui/AppSidebar";
import { AppTopbar } from "../widgets/app-shell/ui/AppTopbar";

const appVersion = "0.1.7";

function createId() {
  return crypto.randomUUID();
}

export function App() {
  const apiUrl = defaultApiUrl;
  const { token, user, setToken, setRefreshToken, setUser } = useAuthSession();
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
  const [activeMenu, setActiveMenu] = useState<WebMenuId>("practice");
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
  const [practiceExams, setPracticeExams] = useState<ExamResponse[]>([]);
  const [attempts, setAttempts] = useState<AttemptSummaryResponse[]>([]);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState("");
  const [practiceReloadKey, setPracticeReloadKey] = useState(0);
  const [selectedPracticeSubject, setSelectedPracticeSubject] = useState("all");
  const [take, setTake] = useState<ExamTakeResponse | null>(null);
  const [takeLoading, setTakeLoading] = useState(false);
  const [takeError, setTakeError] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<AttemptResultResponse | null>(null);
  const [submittingAttempt, setSubmittingAttempt] = useState(false);
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
  const isLoggedIn = token.trim().length > 0 && user !== null;
  const canAccessActiveMenu = canAccessMenu(user, activeMenu);
  const selectedSubject = useMemo(
    () => subjects.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjects]
  );
  const practiceSubjects = useMemo(() => {
    const map = new Map<string, { key: string; name: string; count: number }>();
    for (const exam of practiceExams) {
      const key = exam.subjectId == null ? "none" : String(exam.subjectId);
      const name = exam.subjectName ?? "미분류";
      const current = map.get(key);
      if (current) current.count += 1;
      else map.set(key, { key, name, count: 1 });
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.key === "none") return 1;
      if (b.key === "none") return -1;
      return a.name.localeCompare(b.name, "ko");
    });
  }, [practiceExams]);
  const visiblePracticeExams = useMemo(() => {
    if (selectedPracticeSubject === "all") return practiceExams;
    return practiceExams.filter((exam) => (exam.subjectId == null ? "none" : String(exam.subjectId)) === selectedPracticeSubject);
  }, [practiceExams, selectedPracticeSubject]);
  const practiceStats = useMemo(() => {
    const submitted = attempts.filter((attempt) => attempt.status === "SUBMITTED");
    const averageRate =
      submitted.length === 0
        ? null
        : Math.round(
            submitted.reduce((sum, attempt) => {
              if (attempt.maxScore <= 0) return sum;
              return sum + (attempt.totalScore / attempt.maxScore) * 100;
            }, 0) / submitted.length
          );
    return {
      available: practiceExams.length,
      submitted: submitted.length,
      averageRate,
    };
  }, [attempts, practiceExams.length]);

  useEffect(() => {
    if (!isLoggedIn) {
      setAgents(FALLBACK_AGENTS);
      return;
    }

    let cancelled = false;
    setConnectionStatus("checking");
    fetchAgents(apiUrl, token)
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
    if (activeMenu !== "practice" || !isLoggedIn) return;
    let cancelled = false;
    setPracticeLoading(true);
    setPracticeError("");

    fetchPracticeDashboard(apiUrl, token)
      .then(({ exams, attempts: records }) => {
        if (cancelled) return;
        setPracticeExams(exams);
        setAttempts(records);
      })
      .catch((caught) => {
        if (cancelled) return;
        setPracticeExams([]);
        setAttempts([]);
        setPracticeError(caught instanceof Error ? caught.message : "응시 데이터를 불러오지 못했습니다.");
      })
      .finally(() => {
        if (!cancelled) setPracticeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeMenu, apiUrl, isLoggedIn, practiceReloadKey, token]);

  useEffect(() => {
    if (activeMenu !== "questionMgmt" || !canAccessActiveMenu) return;
    let cancelled = false;
    setQuestionBankLoading(true);
    setQuestionBankError("");

    fetchQuestionBank(apiUrl, token)
      .then(({ categories, embeddingStatus: status }) => {
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
    const categoryId = selectedCategoryId ?? selectedSubject.id;

    fetchQuestionsByCategory({
      apiUrl,
      token,
      categoryId,
      subjectId: selectedSubject.id,
      difficulty: questionDifficulty,
      keyword: questionKeyword,
    })
      .then(({ questions: items, embeddingStatus: status }) => {
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
        const data = await sendChat(apiUrl, token, body);
        const reply = normalizeReply(data.content);
        setMessages((current) =>
          current.map((message) =>
            message.id === agentMessageId ? { ...message, text: reply, streaming: false } : message
          )
        );
      } else {
        const responseText = await streamChat(apiUrl, token, body, (data) => {
            setMessages((current) =>
              current.map((message) =>
                message.id === agentMessageId ? { ...message, text: message.text + data } : message
              )
            );
        });
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
    if (menu !== "practice") {
      setTake(null);
      setResult(null);
      setTakeError("");
    }
  };

  const refreshPractice = () => {
    setPracticeReloadKey((value) => value + 1);
  };

  const startExam = async (exam: ExamResponse) => {
    if (takeLoading) return;
    setTakeLoading(true);
    setTakeError("");
    setResult(null);
    setAnswers({});
    try {
      const data = await startExamAttempt(apiUrl, token, exam.id);
      setTake(data);
      setAnswers(Object.fromEntries(data.items.map((item) => [item.questionId, ""])));
    } catch (caught) {
      setTakeError(caught instanceof Error ? caught.message : "시험 응시를 시작하지 못했습니다.");
    } finally {
      setTakeLoading(false);
    }
  };

  const backToPracticeList = () => {
    setTake(null);
    setResult(null);
    setAnswers({});
    setTakeError("");
    refreshPractice();
  };

  const submitAttempt = async () => {
    if (!take || submittingAttempt) return;
    setSubmittingAttempt(true);
    setTakeError("");
    const payload = {
      answers: take.items.map((item) => ({
        questionId: item.questionId,
        answer: answers[item.questionId] ?? "",
      })),
    };

    try {
      setResult(await submitAttemptAnswers(apiUrl, token, take.attemptId, payload.answers));
      refreshPractice();
    } catch (caught) {
      try {
        setResult(await fetchAttemptResult(apiUrl, token, take.attemptId));
        refreshPractice();
      } catch {
        setTakeError(caught instanceof Error ? caught.message : "답안을 제출하지 못했습니다.");
      }
    } finally {
      setSubmittingAttempt(false);
    }
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
    try {
      await requestQuestionEmbedding(apiUrl, token, question.id);
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
    try {
      await requestPendingQuestionEmbeddings(apiUrl, token, selectedSubject.id);
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
    try {
      await removeQuestion(apiUrl, token, question.id);
      refreshQuestionBank();
    } catch (caught) {
      setQuestionsError(caught instanceof Error ? caught.message : "문제 삭제에 실패했습니다.");
    } finally {
      setQuestionActionBusy("");
    }
  };

  const handleLogin = async (email: string, password: string) => {
    const data = await login(apiUrl, email, password);
    setToken(data.accessToken);
    setRefreshToken(data.refreshToken);
    setUser(data.user);
    setActiveMenu("practice");
  };

  const handleLogout = async () => {
    await logout(apiUrl, token);
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
      <AppSidebar
        menus={WEB_HEADER_MENUS}
        activeMenu={activeMenu}
        activeWebMenu={activeWebMenu}
        user={user}
        connectionStatus={connectionStatus}
        appVersion={appVersion}
        onOpenMenu={openMenu}
        onLogout={() => void handleLogout()}
      />

      <div className="app-content">
        <AppTopbar
          activeMenu={activeMenu}
          activeWebMenu={activeWebMenu}
          selectedAgent={selectedAgent}
        />

        {activeMenu === "practice" && (
          <PracticeView
            exams={visiblePracticeExams}
            subjectGroups={practiceSubjects}
            selectedSubject={selectedPracticeSubject}
            attempts={attempts}
            stats={practiceStats}
            loading={practiceLoading}
            error={practiceError || takeError}
            take={take}
            takeLoading={takeLoading}
            result={result}
            answers={answers}
            submitting={submittingAttempt}
            onSelectSubject={setSelectedPracticeSubject}
            onRefresh={refreshPractice}
            onStartExam={(exam) => void startExam(exam)}
            onBackToList={backToPracticeList}
            onSetAnswer={(questionId, answer) => setAnswers((current) => ({ ...current, [questionId]: answer }))}
            onSubmit={() => void submitAttempt()}
          />
        )}

        {activeMenu === "englishConversation" && (
          <EnglishConversationView
            agents={agents}
            selectedAgent={selectedAgent}
            selectedAgentId={selectedAgentId}
            messages={messages}
            input={input}
            image={image}
            sending={sending}
            connectionStatus={connectionStatus}
            autoTranslate={autoTranslate}
            responseLength={responseLength}
            sidebarTab={sidebarTab}
            draftKo={draftKo}
            feedback={feedback}
            history={history}
            error={error}
            user={user}
            starterPrompts={starterPrompts}
            fileRef={fileRef}
            endRef={endRef}
            onSelectAgent={setSelectedAgentId}
            onSetInput={setInput}
            onSetImage={setImage}
            onSetAutoTranslate={setAutoTranslate}
            onSetResponseLength={setResponseLength}
            onSetSidebarTab={setSidebarTab}
            onSetDraftKo={setDraftKo}
            onSetMessages={setMessages}
            onSendMessage={sendMessage}
            onAttachImage={(files) => void attachImage(files)}
            onBuildFeedback={buildFeedback}
            onSaveSession={saveSession}
          />
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

        {activeMenu !== "practice" && activeMenu !== "englishConversation" && activeMenu !== "questionMgmt" && (
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
