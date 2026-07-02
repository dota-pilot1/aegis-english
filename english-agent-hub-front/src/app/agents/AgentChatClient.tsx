"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Bot, Download, History, ImageIcon, KeyRound, Languages, ListTree, Loader2, Mic, MicOff, Newspaper, Paperclip, Save, Send, Settings2, SlidersHorizontal, Sparkles, Square, Trash2, Upload, Volume2, WandSparkles, X } from "lucide-react";
import * as XLSX from "xlsx-js-style";
import { agentChatApi } from "@/entities/agent/api/agentChatApi";
import type { ChatImageInput, ChatTurn, ChunkAnalysisResponse, ConversationSaveDetail, ConversationSaveSummary } from "@/entities/agent/api/agentChatApi";
import type { LearningAgent } from "@/entities/agent/model/learningAgents";
import { toast, toastError } from "@/shared/lib/toast";
import { Switch } from "@/shared/ui/Switch";
import { useConfirm } from "@/shared/ui/useConfirm";

type ChatMessage = {
  id: string;
  role: "agent" | "learner";
  text: string;
  images?: ChatImageAttachment[];
  sourceText?: string;
  translatedText?: string;
  sourceLabel?: string;
  translatedLabel?: string;
  translating?: boolean;
  streaming?: boolean;
};

type ChatImageAttachment = ChatImageInput & {
  id: string;
  name: string;
};

type SidebarTab = "koen" | "history" | "feedback";

type RealtimePayload = {
  type?: string;
  response_id?: string;
  item_id?: string;
  transcript?: string;
  text?: string;
  delta?: string;
  response?: unknown;
  error?: {
    message?: string;
    code?: string;
    type?: string;
  };
};

type ExpressionFeedback = {
  source: string;
  content: string;
  loading: boolean;
};

type ChunkAnalysisState = {
  loading: boolean;
  source: string;
  data?: ChunkAnalysisResponse;
  error?: string;
};

type ResponseLengthPreset = "1-3" | "3-4" | "4-5" | "unlimited";

const RESPONSE_LENGTH_PRESETS: {
  value: ResponseLengthPreset;
  label: string;
  shortLabel: string;
  instruction: string;
}[] = [
  {
    value: "1-3",
    label: "1-3문장",
    shortLabel: "1-3",
    instruction:
      "Override any previous reply length rule: keep each character reply to 1 to 3 short sentences. No lists or long paragraphs unless the learner explicitly asks.",
  },
  {
    value: "3-4",
    label: "3-4문장",
    shortLabel: "3-4",
    instruction:
      "Override any previous reply length rule: keep each character reply to 3 to 4 short sentences. Avoid lists unless the learner explicitly asks.",
  },
  {
    value: "4-5",
    label: "4-5문장",
    shortLabel: "4-5",
    instruction:
      "Override any previous reply length rule: keep each character reply to 4 to 5 short sentences. Avoid overly long paragraphs.",
  },
  {
    value: "unlimited",
    label: "무제한",
    shortLabel: "∞",
    instruction:
      "Override any previous reply length rule: there is no fixed sentence limit. Still keep the reply natural and avoid unnecessary filler.",
  },
];

const CONVERSATION_QUALITY_INSTRUCTION =
  "Highest priority conversation rule: answer the learner's latest message directly and specifically before doing anything else. If the learner asks your name, say your name. If they ask a direct question, answer that question. Only use a generic greeting on the first turn when the learner has not asked a specific question. Do not suggest what the learner can say unless they ask for help, seem stuck, or click a suggestion/help feature. Stay in character as the friend, not as a teacher. Write like natural spoken conversation: avoid em dashes, double hyphens, markdown bullets, and decorative punctuation.";

const KOREAN_INPUT_INSTRUCTION =
  "If the learner writes in Korean, understand the Korean text directly. Do not treat any English translation as authoritative. Preserve named entities, slang, memes, product names, and newly coined terms exactly when relevant. Reply in natural English by default unless the learner explicitly asks for Korean.";

function isResponseLengthPreset(value: string | null): value is ResponseLengthPreset {
  return RESPONSE_LENGTH_PRESETS.some((preset) => preset.value === value);
}

function getResponseLengthInstruction(value: ResponseLengthPreset) {
  return RESPONSE_LENGTH_PRESETS.find((preset) => preset.value === value)?.instruction ?? RESPONSE_LENGTH_PRESETS[0].instruction;
}

function formatRecordingDuration(ms: number) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function readImageAsDataUrl(file: File) {
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

function normalizeSpokenReply(text: string) {
  return text
    .replace(/(\d+(?:\.\d+)?)\s*°\s*C\b/gi, "$1 degrees Celsius")
    .replace(/(\d+(?:\.\d+)?)\s*°\s*F\b/gi, "$1 degrees Fahrenheit")
    .replace(/\s*[—–]\s*/g, ", ")
    .replace(/\s+--\s+/g, ", ")
    .replace(/\s{2,}/g, " ")
    .replace(/\s+([,.!?])/g, "$1")
    .trim();
}

type SpeechRecognitionResultEventLike = {
  results: {
    length: number;
    [index: number]: {
      [index: number]: {
        transcript: string;
      };
    };
  };
};

type SpeechRecognitionLike = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: SpeechRecognitionResultEventLike) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognitionLike;
  webkitSpeechRecognition?: new () => SpeechRecognitionLike;
};

function extractClientSecret(raw: Record<string, unknown>): string | null {
  const clientSecret = raw.client_secret;
  if (typeof raw.value === "string") return raw.value;
  if (typeof clientSecret === "string") return clientSecret;
  if (
    clientSecret &&
    typeof clientSecret === "object" &&
    "value" in clientSecret &&
    typeof clientSecret.value === "string"
  ) {
    return clientSecret.value;
  }
  return null;
}

function getRealtimeEventKey(payload: RealtimePayload) {
  return payload.response_id ?? payload.item_id ?? "current";
}

function extractResponseText(response: unknown): string | null {
  const textParts: string[] = [];
  const visited = new Set<unknown>();

  const collectText = (value: unknown) => {
    if (!value || typeof value !== "object" || visited.has(value)) return;
    visited.add(value);

    if ("transcript" in value && typeof value.transcript === "string") {
      textParts.push(value.transcript);
    }
    if ("text" in value && typeof value.text === "string") {
      textParts.push(value.text);
    }

    Object.values(value).forEach(collectText);
  };

  collectText(response);
  const text = Array.from(new Set(textParts.map((part) => part.trim()).filter(Boolean))).join("\n").trim();
  return text || null;
}

function getAgentAccentClass(agentId: string) {
  const accentMap: Record<string, string> = {
    debate: "border-sky-200 bg-sky-50 text-sky-700",
  };

  return accentMap[agentId] ?? "border-border bg-muted text-muted-foreground";
}

function hasKorean(text: string) {
  return /[ㄱ-ㅎㅏ-ㅣ가-힣]/.test(text);
}

function getExpressionSource(message: ChatMessage) {
  if (message.sourceLabel === "English" && message.sourceText?.trim()) return message.sourceText.trim();
  if (message.translatedLabel === "English" && message.translatedText?.trim()) return message.translatedText.trim();
  if (message.text.trim()) return message.text.trim();
  return message.sourceText?.trim() ?? "";
}

function getChunkAnalysisSource(message: ChatMessage) {
  if (message.translatedLabel === "English" && message.translatedText?.trim()) return message.translatedText.trim();
  if (message.sourceLabel === "English" && message.sourceText?.trim()) return message.sourceText.trim();
  if (message.text.trim() && !hasKorean(message.text)) return message.text.trim();
  return "";
}

function getExpressionSuggestions(feedback: ExpressionFeedback | null): string[] {
  if (!feedback?.content) return [];
  const marker = "자연스러운 표현:";
  const start = feedback.content.indexOf(marker);
  if (start < 0) return [];

  const after = feedback.content.slice(start + marker.length);
  const stops = ["왜 더 자연스러운가", "바로 쓰기"]
    .map((m) => after.indexOf(m))
    .filter((index) => index >= 0);
  const end = stops.length ? Math.min(...stops) : after.length;

  return after
    .slice(0, end)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /^[-•]/.test(line))
    .map((line) => line.replace(/^[-•]\s*/, "").replace(/^["“”]+|["“”]+$/g, "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

function getExpressionReason(feedback: ExpressionFeedback | null): string {
  if (!feedback?.content) return "";
  const marker = "왜 더 자연스러운가";
  const start = feedback.content.indexOf(marker);
  if (start < 0) return "";

  let after = feedback.content.slice(start + marker.length).replace(/^[:：]\s*/, "");
  const stop = after.indexOf("바로 쓰기");
  if (stop >= 0) after = after.slice(0, stop);
  return after.trim();
}

function delay(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

function formatConversationSavedAt(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function getConversationPreview(message: ChatMessage) {
  return (message.sourceText ?? message.text ?? message.translatedText ?? "").trim();
}

function TypingDots() {
  return (
    <span className="flex items-center gap-1 py-1" aria-label="응답 작성 중">
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.3s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50 [animation-delay:-0.15s]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50" />
    </span>
  );
}

function ChunkAnalysisDialog({
  open,
  state,
  onClose,
  onSpeak,
  speakingMessageId,
}: {
  open: boolean;
  state?: ChunkAnalysisState;
  onClose: () => void;
  onSpeak: (messageId: string, text: string) => void;
  speakingMessageId: string | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !state) return null;

  const data = state.data;
  const fullAudioId = `chunk-analysis:${state.source}:all`;
  const isSpeakingFull = speakingMessageId === fullAudioId;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="chunk-analysis-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85vh] w-full max-w-lg flex-col rounded-lg border border-border bg-background shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 id="chunk-analysis-title" className="flex items-center gap-1.5 text-sm font-semibold">
              <ListTree className="h-4 w-4 text-primary" />
              청크 분석
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <p className="min-w-0 break-words text-xs text-muted-foreground">{state.source}</p>
              <button
                type="button"
                onClick={() => onSpeak(fullAudioId, state.source)}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                title={isSpeakingFull ? "전체 듣기 중지" : "전체 문장 듣기"}
              >
                {isSpeakingFull ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                {isSpeakingFull ? "중지" : "전체 듣기"}
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 text-sm">
          {state.loading ? (
            <div className="flex items-center gap-2 py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              문장을 의미 단위로 분석하는 중...
            </div>
          ) : state.error ? (
            <div className="rounded-md border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {state.error}
            </div>
          ) : data ? (
            <div className="space-y-4">
              <div className="space-y-2.5">
                {data.chunks.map((chunk, index) => (
                  <div
                    key={`${index}-${chunk.en}`}
                    className="flex flex-col gap-1 border-l-2 border-primary/40 pl-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-foreground">{chunk.en}</span>
                      <button
                        type="button"
                        onClick={() => onSpeak(`chunk-analysis:${state.source}:${index}`, chunk.en)}
                        className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                        title="이 청크 듣기"
                        aria-label="이 청크 듣기"
                      >
                        {speakingMessageId === `chunk-analysis:${state.source}:${index}` ? (
                          <Square className="h-3.5 w-3.5" />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </div>
                    <span className="text-muted-foreground">
                      → {chunk.ko}
                      {chunk.note?.trim() ? (
                        <span className="ml-1 text-xs text-primary/80">({chunk.note.trim()})</span>
                      ) : null}
                    </span>
                  </div>
                ))}
              </div>
              {data.natural?.trim() && (
                <div className="border-t border-border pt-3">
                  <div className="text-[10px] font-semibold uppercase text-muted-foreground">자연스럽게</div>
                  <p className="mt-1 font-medium leading-6 text-foreground">{data.natural.trim()}</p>
                </div>
              )}
              {data.tip?.trim() && (
                <div className="rounded-md bg-muted/60 px-3 py-2 leading-6 text-muted-foreground">
                  💡 {data.tip.trim()}
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type AgentInstructions = {
  style: string;
  scenario: string;
  character: string;
  knowledge: string;
  news: string;
  schedule: string;
};

const EMPTY_INSTRUCTIONS: AgentInstructions = {
  style: "",
  scenario: "",
  character: "",
  knowledge: "",
  news: "",
  schedule: "",
};

const INSTRUCTION_TABS: { key: keyof AgentInstructions; label: string; placeholder: string }[] = [
  {
    key: "style",
    label: "대화 스타일",
    placeholder:
      "예: 친구처럼 편한 반말 톤으로, 쉬운 단어만 써서 1~2문장으로 짧게 답해줘. 가끔 더 자연스러운 표현을 한 줄 알려줘.",
  },
  {
    key: "character",
    label: "캐릭터 정보",
    placeholder: "예: 이름은 Mike, 29살, 취미는 자전거 타기, 직업은 야구 선수.",
  },
  {
    key: "knowledge",
    label: "알고 있는 지식",
    placeholder: "예: 스타크래프트 테란 유저. 한국 음식을 좋아함. 서울에 한 번 가봤음.",
  },
  {
    key: "news",
    label: "오늘의 뉴스",
    placeholder:
      "예: 오늘 한국에 첫눈이 왔다. 손흥민이 어제 골을 넣었다. — 대화 중 자연스럽게 화제로 꺼내줘.",
  },
  {
    key: "schedule",
    label: "캐릭터 근황",
    placeholder:
      "예: 오늘 아침 자전거 탔음. 어제 경기에서 홈런 침. 요즘 한국어 공부 중. — 대화 중 자기 근황으로 자연스럽게 풀어줘.",
  },
  {
    key: "scenario",
    label: "예제 시나리오",
    placeholder: `예 (카페 응대 시나리오):
1) 인사하고 무엇을 주문하실지 묻기
2) 사이즈(Tall/Grande/Venti) 묻기
3) 핫/아이스, 시럽, 휘핑 같은 옵션 묻기
4) 추가 메뉴 있는지 묻기
5) 매장/포장 여부 묻기
6) 결제 방식 묻고 영수증/포인트 마무리

이 절차를 한 번에 한 단계씩 진행하고, 학습자가 답하기 전엔 다음 단계로 넘어가지 마.`,
  },
];

function composeInstructions(instr: AgentInstructions): string {
  const parts: string[] = [];
  if (instr.style.trim()) parts.push(`[Conversation style]\n${instr.style.trim()}`);
  if (instr.scenario.trim()) parts.push(`[Scenario / procedure to follow]\n${instr.scenario.trim()}`);
  if (instr.character.trim()) parts.push(`[Character]\n${instr.character.trim()}`);
  if (instr.knowledge.trim()) parts.push(`[Background knowledge]\n${instr.knowledge.trim()}`);
  if (instr.news.trim()) parts.push(`[Today's news to bring up naturally]\n${instr.news.trim()}`);
  if (instr.schedule.trim()) parts.push(`[Your (the character's) recent updates to mention naturally]\n${instr.schedule.trim()}`);
  return parts.join("\n\n");
}

function parseStoredInstructions(stored: string | null): AgentInstructions {
  if (!stored) return EMPTY_INSTRUCTIONS;
  try {
    const parsed = JSON.parse(stored);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      const read = (key: keyof AgentInstructions) =>
        typeof parsed[key] === "string" ? (parsed[key] as string) : "";
      const result: AgentInstructions = {
        style: read("style"),
        scenario: read("scenario"),
        character: read("character"),
        knowledge: read("knowledge"),
        news: read("news"),
        schedule: read("schedule"),
      };
      if (Object.values(result).some((value) => value.trim())) return result;
    }
  } catch {
    // legacy: a plain free-text string was stored — treat it as conversation style
  }
  return { ...EMPTY_INSTRUCTIONS, style: stored };
}

const REALTIME_IDLE_LIMIT_MS = 120_000;

export function AgentChatClient({ agentId, variant = "desktop" }: { agentId: string; variant?: "desktop" | "mobile" }) {
  const { confirm, confirmDialog } = useConfirm();
  const [agent, setAgent] = useState<LearningAgent | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState<"idle" | "connecting" | "connected">("idle");
  const [autoKoEn, setAutoKoEn] = useState(true);
  const [micMuted, setMicMuted] = useState(false);
  const [expressionFeedback, setExpressionFeedback] = useState<ExpressionFeedback | null>(null);
  const [expressionDraft, setExpressionDraft] = useState("");
  const [expressionListening, setExpressionListening] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(false);
  const [responseLength, setResponseLength] = useState<ResponseLengthPreset>("1-3");
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [inputListening, setInputListening] = useState(false);
  const [inputTranscribing, setInputTranscribing] = useState(false);
  const [inputRecordingMs, setInputRecordingMs] = useState(0);
  const [inputAudioLevel, setInputAudioLevel] = useState(0);
  const [suggestingReply, setSuggestingReply] = useState(false);
  const [instr, setInstr] = useState<AgentInstructions>(EMPTY_INSTRUCTIONS);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [instrDraft, setInstrDraft] = useState<AgentInstructions>(EMPTY_INSTRUCTIONS);
  const [settingsTab, setSettingsTab] = useState<keyof AgentInstructions>("style");
  const [newsLoading, setNewsLoading] = useState(false);
  const [newsPromptOpen, setNewsPromptOpen] = useState(false);
  const [newsQuery, setNewsQuery] = useState("");
  const [chunkAnalysis, setChunkAnalysis] = useState<Record<string, ChunkAnalysisState>>({});
  const [openChunkId, setOpenChunkId] = useState<string | null>(null);
  const [savingConversation, setSavingConversation] = useState(false);
  const [savedListOpen, setSavedListOpen] = useState(false);
  const [savedConversations, setSavedConversations] = useState<ConversationSaveSummary[]>([]);
  const [savedConversationsLoading, setSavedConversationsLoading] = useState(false);
  const [selectedSavedConversation, setSelectedSavedConversation] = useState<ConversationSaveDetail | null>(null);
  const [selectedSavedConversationLoading, setSelectedSavedConversationLoading] = useState(false);
  const [savedConversationNoteDraft, setSavedConversationNoteDraft] = useState("");
  const [savingConversationNote, setSavingConversationNote] = useState(false);
  const [attachedImages, setAttachedImages] = useState<ChatImageAttachment[]>([]);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("koen");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const peerRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const textAreaRef = useRef<HTMLTextAreaElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const xlsxInputRef = useRef<HTMLInputElement | null>(null);
  const expressionRecognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordChunksRef = useRef<Blob[]>([]);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const inputMeterFrameRef = useRef<number | null>(null);
  const inputRecordingStartedAtRef = useRef(0);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const inputAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const ttsAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsCacheRef = useRef(new Map<string, string>());
  const realtimeTextRef = useRef(new Map<string, string>());
  const completedRealtimeItemsRef = useRef(new Set<string>());
  const realtimeResponseActiveRef = useRef(false);
  const pendingRealtimeMessagesRef = useRef<string[]>([]);
  const realtimeIdleTimerRef = useRef<number | null>(null);

  const voiceStatusText = useMemo(() => {
    if (voiceStatus === "connected") return "Realtime 연결됨";
    if (voiceStatus === "connecting") return "Realtime 연결 중";
    return "Realtime 연결 대기";
  }, [voiceStatus]);

  const stopInputMeter = () => {
    if (inputMeterFrameRef.current !== null) {
      window.cancelAnimationFrame(inputMeterFrameRef.current);
      inputMeterFrameRef.current = null;
    }
    inputAudioSourceRef.current?.disconnect();
    inputAudioSourceRef.current = null;
    void inputAudioContextRef.current?.close();
    inputAudioContextRef.current = null;
    inputRecordingStartedAtRef.current = 0;
    setInputAudioLevel(0);
    setInputRecordingMs(0);
  };

  const startInputMeter = (stream: MediaStream) => {
    stopInputMeter();
    const audioWindow = window as Window & typeof globalThis & { webkitAudioContext?: typeof AudioContext };
    const AudioContextCtor = audioWindow.AudioContext || audioWindow.webkitAudioContext;
    if (!AudioContextCtor) return;

    const audioContext = new AudioContextCtor();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 512;
    source.connect(analyser);

    const samples = new Uint8Array(analyser.fftSize);
    inputAudioContextRef.current = audioContext;
    inputAudioSourceRef.current = source;
    inputRecordingStartedAtRef.current = performance.now();

    const tick = () => {
      analyser.getByteTimeDomainData(samples);
      let sum = 0;
      samples.forEach((sample) => {
        const normalized = (sample - 128) / 128;
        sum += normalized * normalized;
      });
      const rms = Math.sqrt(sum / samples.length);
      setInputAudioLevel(Math.min(1, rms * 6));
      setInputRecordingMs(performance.now() - inputRecordingStartedAtRef.current);
      inputMeterFrameRef.current = window.requestAnimationFrame(tick);
    };

    tick();
  };

  useEffect(() => {
    let mounted = true;
    const ttsCache = ttsCacheRef.current;

    agentChatApi
      .getAgent(agentId)
      .then((data) => {
        if (!mounted) return;
        setAgent(data);
      })
      .catch((error) => {
        toastError(error, "에이전트 정보를 가져오지 못했습니다.");
      });

    setInstr(parseStoredInstructions(window.localStorage.getItem(`agent-chat:instructions:${agentId}`)));

    return () => {
      mounted = false;
      if (realtimeIdleTimerRef.current !== null) {
        window.clearTimeout(realtimeIdleTimerRef.current);
      }
      peerRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordStreamRef.current?.getTracks().forEach((track) => track.stop());
      stopInputMeter();
      ttsAudioRef.current?.pause();
      ttsCache.forEach((url) => URL.revokeObjectURL(url));
      ttsCache.clear();
    };
  }, [agentId]);

  useEffect(() => {
    const storedAutoKoEn = window.localStorage.getItem("agent-chat:auto-ko-en");
    const storedMicMuted = window.localStorage.getItem("agent-chat:mic-muted");
    const storedAutoSpeak = window.localStorage.getItem("agent-chat:auto-speak");
    const storedResponseLength = window.localStorage.getItem("agent-chat:response-length");
    if (storedAutoKoEn !== null) setAutoKoEn(storedAutoKoEn === "true");
    if (storedMicMuted !== null) setMicMuted(storedMicMuted === "true");
    if (storedAutoSpeak !== null) setAutoSpeak(storedAutoSpeak === "true");
    if (isResponseLengthPreset(storedResponseLength)) setResponseLength(storedResponseLength);
  }, []);

  useEffect(() => {
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !micMuted;
    });
    window.localStorage.setItem("agent-chat:mic-muted", String(micMuted));
  }, [micMuted]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, sending]);

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (savedListOpen) {
        setSavedListOpen(false);
        return;
      }
      if (newsPromptOpen && !newsLoading) {
        setNewsPromptOpen(false);
        return;
      }
      if (settingsOpen) {
        setSettingsOpen(false);
      }
    };

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [newsLoading, newsPromptOpen, savedListOpen, settingsOpen]);

  const appendRealtimeMessage = (role: ChatMessage["role"], text: string, options?: Partial<ChatMessage>) => {
    const trimmed = (role === "agent" ? normalizeSpokenReply(text) : text.trim());
    if (!trimmed) return;

    setMessages((current) => {
      const last = current.at(-1);
      if (last?.role === role && last.text === trimmed) return current;
      return [...current, { id: crypto.randomUUID(), role, text: trimmed, ...options }];
    });
  };

  const appendLearnerMessage = (message: {
    text: string;
    sourceText?: string;
    translatedText?: string;
    sourceLabel?: string;
    translatedLabel?: string;
  }) => {
    appendRealtimeMessage("learner", message.text, {
      sourceText: message.sourceText,
      translatedText: message.translatedText,
      sourceLabel: message.sourceLabel,
      translatedLabel: message.translatedLabel,
    });
  };

  const updateMessage = (messageId: string, updates: Partial<ChatMessage>) => {
    setMessages((current) =>
      current.map((message) =>
        message.id === messageId
          ? {
              ...message,
              ...updates,
            }
          : message
      )
    );
  };

  const appendRealtimeDelta = (key: string, delta: string) => {
    if (!delta) return;
    const messageId = `realtime-${key}`;
    realtimeTextRef.current.set(key, `${realtimeTextRef.current.get(key) ?? ""}${delta}`);

    setMessages((current) => {
      const exists = current.some((message) => message.id === messageId);
      if (!exists) {
        return [...current, { id: messageId, role: "agent", text: delta, streaming: true }];
      }

      return current.map((message) =>
        message.id === messageId ? { ...message, text: `${message.text}${delta}`, streaming: true } : message
      );
    });
  };

  const finalizeRealtimeMessage = (key: string, fallbackText: string) => {
    const messageId = `realtime-${key}`;
    const text = normalizeSpokenReply(realtimeTextRef.current.get(key) ?? fallbackText);
    realtimeTextRef.current.delete(key);
    if (!text) return;

    setMessages((current) => {
      const exists = current.some((message) => message.id === messageId);
      if (!exists) return [...current, { id: messageId, role: "agent", text, streaming: false }];
      return current.map((message) =>
        message.id === messageId ? { ...message, text, streaming: false } : message
      );
    });
    void translateAgentMessage(messageId, text);
  };

  const stopRealtimeSession = (options?: { silent?: boolean; message?: string }) => {
    if (realtimeIdleTimerRef.current !== null) {
      window.clearTimeout(realtimeIdleTimerRef.current);
      realtimeIdleTimerRef.current = null;
    }
    peerRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    audioRef.current?.remove();
    peerRef.current = null;
    dataChannelRef.current = null;
    mediaStreamRef.current = null;
    audioRef.current = null;
    realtimeTextRef.current.clear();
    completedRealtimeItemsRef.current.clear();
    realtimeResponseActiveRef.current = false;
    pendingRealtimeMessagesRef.current = [];
    setVoiceStatus("idle");
    if (!options?.silent) {
      toast.success(options?.message ?? "Realtime 음성 세션이 종료되었습니다.");
    }
  };

  const scheduleRealtimeIdleTimeout = () => {
    if (realtimeIdleTimerRef.current !== null) {
      window.clearTimeout(realtimeIdleTimerRef.current);
    }

    realtimeIdleTimerRef.current = window.setTimeout(() => {
      stopRealtimeSession({
        message: "음성 입력이 없어 비용 절감을 위해 세션을 자동 종료했습니다.",
      });
    }, REALTIME_IDLE_LIMIT_MS);
  };

  const toggleAutoKoEn = (enabled: boolean) => {
    setAutoKoEn(enabled);
    window.localStorage.setItem("agent-chat:auto-ko-en", String(enabled));
    if (voiceStatus === "connected") {
      stopRealtimeSession();
      window.setTimeout(() => {
        void startRealtimeSession(enabled, true);
      }, 0);
      toast.info("자동 번역 설정을 적용하려고 음성 세션을 다시 시작합니다.");
    }
  };

  const toggleMicMuted = (enabled: boolean) => {
    setMicMuted(enabled);
    mediaStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !enabled;
    });
  };

  const toggleAutoSpeak = (enabled: boolean) => {
    setAutoSpeak(enabled);
    window.localStorage.setItem("agent-chat:auto-speak", String(enabled));
  };

  const buildEffectiveInstructions = (
    instructionsValue: AgentInstructions = instr,
    lengthValue: ResponseLengthPreset = responseLength
  ) => {
    const parts = [
      agent?.systemPrompt?.trim(),
      composeInstructions(instructionsValue),
      CONVERSATION_QUALITY_INSTRUCTION,
      autoKoEn ? KOREAN_INPUT_INSTRUCTION : undefined,
      getResponseLengthInstruction(lengthValue),
    ]
      .filter((part): part is string => Boolean(part?.trim()));
    return parts.join("\n\n");
  };

  const buildRealtimeInstructions = (override: string) => {
    const base = override.trim() || buildEffectiveInstructions();
    if (!autoKoEn) return base;
    return (
      base +
      " When the learner speaks Korean, understand it as Korean input for English practice: translate their meaning into natural English internally, show or use the English phrasing, and respond in English unless they explicitly ask otherwise."
    );
  };

  const syncRealtimeInstructions = (instructionsText: string) => {
    const dataChannel = dataChannelRef.current;
    if (voiceStatus !== "connected" || dataChannel?.readyState !== "open") return;
    dataChannel.send(
      JSON.stringify({
        type: "session.update",
        session: { type: "realtime", instructions: buildRealtimeInstructions(instructionsText) },
      })
    );
  };

  const applyInstructions = (value: AgentInstructions) => {
    setInstr(value);
    const composed = composeInstructions(value);
    if (composed) {
      window.localStorage.setItem(`agent-chat:instructions:${agentId}`, JSON.stringify(value));
    } else {
      window.localStorage.removeItem(`agent-chat:instructions:${agentId}`);
    }

    if (voiceStatus === "connected") {
      syncRealtimeInstructions(buildEffectiveInstructions(value, responseLength));
      toast.success("실시간 세션에 새 지침을 반영했습니다.");
    }
  };

  const updateResponseLength = (value: ResponseLengthPreset) => {
    setResponseLength(value);
    window.localStorage.setItem("agent-chat:response-length", value);
    if (voiceStatus === "connected") {
      syncRealtimeInstructions(buildEffectiveInstructions(instr, value));
      toast.success("응답 길이를 실시간 세션에 반영했습니다.");
    }
  };

  const openSettings = (tab: keyof AgentInstructions = "style") => {
    setInstrDraft(instr);
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const saveSettings = () => {
    applyInstructions(instrDraft);
    setSettingsOpen(false);
    toast.success("에이전트 지침을 저장했습니다.");
  };

  // 현재 작성 중인 6개 항목을 보기 좋게 스타일링한 엑셀(.xlsx)로 내보낸다. (항목 | 내용)
  const exportInstructionsXlsx = () => {
    const rows = INSTRUCTION_TABS.map((tab) => ({ 항목: tab.label, 내용: instrDraft[tab.key] ?? "" }));
    const sheet = XLSX.utils.json_to_sheet(rows, { header: ["항목", "내용"] });
    sheet["!cols"] = [{ wch: 16 }, { wch: 90 }];

    const thin = { style: "thin", color: { rgb: "D1D5DB" } };
    const border = { top: thin, bottom: thin, left: thin, right: thin };

    // 헤더 행: 진한 배경 + 흰 글자
    ["A1", "B1"].forEach((addr) => {
      if (!sheet[addr]) return;
      sheet[addr].s = {
        font: { bold: true, sz: 11, color: { rgb: "FFFFFF" } },
        fill: { patternType: "solid", fgColor: { rgb: "2563EB" } },
        alignment: { horizontal: "left", vertical: "center" },
        border,
      };
    });

    const rowHeights = [{ hpt: 22 }];
    rows.forEach((row, i) => {
      const r = i + 2; // 엑셀은 1-base, 헤더가 1행
      const aAddr = `A${r}`;
      const bAddr = `B${r}`;
      // 첫 열(항목): 옅은 파란 배경 + 굵게 + 세로 가운데
      if (sheet[aAddr]) {
        sheet[aAddr].s = {
          font: { bold: true, color: { rgb: "1F2937" } },
          fill: { patternType: "solid", fgColor: { rgb: "EFF6FF" } },
          alignment: { horizontal: "left", vertical: "center", wrapText: true },
          border,
        };
      }
      // 내용: 세로 위 정렬 + 자동 줄바꿈
      if (sheet[bAddr]) {
        sheet[bAddr].s = {
          font: { color: { rgb: "111827" } },
          alignment: { horizontal: "left", vertical: "top", wrapText: true },
          border,
        };
      }
      // 기본 5줄 높이 확보, 내용이 더 길면 줄 수에 맞춰 확장(최대 30줄)
      const lineCount = (row.내용.match(/\n/g)?.length ?? 0) + 1;
      const lines = Math.min(Math.max(lineCount, 5), 30);
      rowHeights.push({ hpt: lines * 16 });
    });
    sheet["!rows"] = rowHeights;

    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "캐릭터 지침");
    const safeTitle = (agent?.title || "agent").replace(/[\\/:*?"<>|]/g, "_");
    XLSX.writeFile(book, `캐릭터지침_${safeTitle}.xlsx`);
  };

  // 엑셀(.xlsx)을 읽어 항목 라벨로 매칭해 작성칸을 채운다.
  const importInstructionsXlsx = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const book = XLSX.read(buffer, { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      if (!sheet) throw new Error("빈 파일");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      const labelToKey = new Map(INSTRUCTION_TABS.map((tab) => [tab.label.trim(), tab.key]));
      const next = { ...EMPTY_INSTRUCTIONS };
      let matched = 0;
      for (const row of rows) {
        const label = String(row["항목"] ?? "").trim();
        const key = labelToKey.get(label);
        if (!key) continue;
        next[key] = String(row["내용"] ?? "");
        matched += 1;
      }
      if (matched === 0) {
        toast.info("매칭되는 항목이 없습니다. '항목'/'내용' 열과 항목명을 확인하세요.");
        return;
      }
      setInstrDraft(next);
      toast.success(`${matched}개 항목을 불러왔습니다. 저장을 눌러 적용하세요.`);
    } catch (error) {
      toastError(error, "엑셀을 읽지 못했습니다.");
    }
  };

  const loadNews = async (query?: string) => {
    const q = typeof query === "string" ? query.trim() : undefined;
    setNewsLoading(true);
    try {
      const { items } = await agentChatApi.fetchNews("ko", q);
      if (!items.length) {
        toast.info(q ? `"${q}" 관련 뉴스를 찾지 못했습니다.` : "가져올 뉴스가 없습니다.");
        return;
      }
      const heading = q
        ? `"${q}" 관련 뉴스 (대화 중 자연스럽게 화제로 꺼내줘):`
        : "오늘의 뉴스 (대화 중 자연스럽게 화제로 꺼내줘):";
      const formatted = [heading, ...items.map((title, index) => `${index + 1}. ${title}`)].join("\n");
      setInstrDraft((draft) => ({ ...draft, news: formatted }));
      setSettingsTab("news");
      setNewsPromptOpen(false);
      toast.success(q ? `"${q}" 뉴스 ${items.length}개를 채웠습니다.` : `오늘의 뉴스 ${items.length}개를 채웠습니다.`);
    } catch (error) {
      toastError(error, "뉴스를 가져오지 못했습니다.");
    } finally {
      setNewsLoading(false);
    }
  };

  const stopSpeaking = () => {
    const audio = ttsAudioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setSpeakingMessageId(null);
  };

  const speakMessage = async (messageId: string, rawText: string) => {
    const text = rawText.trim();
    if (!text) return;

    if (speakingMessageId === messageId) {
      stopSpeaking();
      return;
    }
    stopSpeaking();

    try {
      let url = ttsCacheRef.current.get(messageId);
      if (!url) {
        const buffer = await agentChatApi.synthesizeSpeech(text);
        const blob = new Blob([buffer], { type: "audio/mpeg" });
        url = URL.createObjectURL(blob);
        ttsCacheRef.current.set(messageId, url);
      }

      const audio = new Audio(url);
      ttsAudioRef.current = audio;
      audio.onended = () => setSpeakingMessageId((id) => (id === messageId ? null : id));
      audio.onerror = () => setSpeakingMessageId((id) => (id === messageId ? null : id));
      setSpeakingMessageId(messageId);
      await audio.play();
    } catch (error) {
      setSpeakingMessageId((id) => (id === messageId ? null : id));
      toastError(error, "음성을 재생하지 못했습니다.");
    }
  };

  const startInputRecording = async () => {
    if (typeof MediaRecorder === "undefined") {
      toast.error("이 브라우저는 음성 녹음을 지원하지 않습니다.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      recordStreamRef.current = stream;
      recordChunksRef.current = [];
      startInputMeter(stream);

      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordChunksRef.current.push(event.data);
      };
      recorder.onstop = async () => {
        recordStreamRef.current?.getTracks().forEach((track) => track.stop());
        recordStreamRef.current = null;
        stopInputMeter();
        const blob = new Blob(recordChunksRef.current, { type: recorder.mimeType || "audio/webm" });
        recordChunksRef.current = [];
        if (blob.size === 0) return;

        setInputTranscribing(true);
        try {
          const { text } = await agentChatApi.transcribeAudio(blob, "en");
          const trimmed = text?.trim();
          if (trimmed) setInput(trimmed);
          else toast.info("음성에서 인식된 내용이 없습니다.");
        } catch (error) {
          toastError(error, "음성 인식에 실패했습니다.");
        } finally {
          setInputTranscribing(false);
          textAreaRef.current?.focus();
        }
      };

      recorder.start();
      setInputListening(true);
    } catch (error) {
      toastError(error, "마이크를 사용할 수 없습니다.");
      setInputListening(false);
    }
  };

  const toggleInputVoiceInput = () => {
    if (inputTranscribing) return;
    if (inputListening) {
      mediaRecorderRef.current?.stop();
      setInputListening(false);
      return;
    }
    void startInputRecording();
  };

  const handleImageFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    const remainingSlots = 3 - attachedImages.length;
    if (remainingSlots <= 0) {
      toast.info("이미지는 최대 3장까지 첨부할 수 있습니다.");
      return;
    }

    const selected = Array.from(files).slice(0, remainingSlots);
    const supportedTypes = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
    const validFiles = selected.filter((file) => {
      if (!supportedTypes.has(file.type)) {
        toast.error(`${file.name}은 PNG, JPG, WebP, GIF 중 하나여야 합니다.`);
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}은 5MB보다 작아야 합니다.`);
        return false;
      }
      return true;
    });

    try {
      const images = await Promise.all(
        validFiles.map(async (file) => ({
          id: crypto.randomUUID(),
          name: file.name,
          dataUrl: await readImageAsDataUrl(file),
        }))
      );
      setAttachedImages((current) => [...current, ...images]);
    } catch (error) {
      toastError(error, "이미지를 첨부하지 못했습니다.");
    } finally {
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  };

  const removeAttachedImage = (imageId: string) => {
    setAttachedImages((current) => current.filter((image) => image.id !== imageId));
  };

  const requestSuggestedReply = async () => {
    if (suggestingReply) return;

    const pickText = (m: ChatMessage | undefined) =>
      (m?.sourceText ?? m?.text ?? "").trim();

    const lastAgent = [...messages].reverse().find((m) => m.role === "agent");
    const lastLearner = [...messages].reverse().find((m) => m.role === "learner");

    // 최근 6개 메시지를 oldest→newest 순으로 직렬화 (코치 모델이 흐름 전체를 보도록)
    const recent = messages.slice(-6);
    const recentHistory = recent
      .map((m) => {
        const role = m.role === "agent" ? "Character" : "Learner";
        const text = pickText(m);
        return text ? `${role}: ${text}` : "";
      })
      .filter(Boolean)
      .join("\n");

    setSuggestingReply(true);
    try {
      const { text } = await agentChatApi.suggestReply({
        agentId: agent?.id,
        instructions: buildEffectiveInstructions() || undefined,
        lastAgentMessage: pickText(lastAgent) || undefined,
        lastLearnerMessage: pickText(lastLearner) || undefined,
        recentHistory: recentHistory || undefined,
      });
      const trimmed = text?.trim();
      if (trimmed) {
        setInput(trimmed);
        textAreaRef.current?.focus();
      } else {
        toast.info("추천 답변을 만들지 못했습니다.");
      }
    } catch (error) {
      toastError(error, "추천 답변을 가져오지 못했습니다.");
    } finally {
      setSuggestingReply(false);
    }
  };

  const withTranslationRetry = async <T,>(translate: () => Promise<T>) => {
    try {
      return await translate();
    } catch (firstError) {
      await delay(700);
      try {
        return await translate();
      } catch {
        throw firstError;
      }
    }
  };

  const prepareLearnerInput = async (message: string) => {
    const original = message.trim();
    if (!autoKoEn) {
      return { displayText: original, modelText: original };
    }

    if (!hasKorean(original)) {
      const korean = (await withTranslationRetry(() => agentChatApi.translateToKorean(original))).text.trim();
      return {
        displayText: original,
        modelText: original,
        sourceText: original,
        translatedText: korean,
        sourceLabel: "English",
        translatedLabel: "한국어",
      };
    }

    const english = (await withTranslationRetry(() => agentChatApi.translateToEnglish(original))).text.trim();
    return {
      displayText: english,
      modelText: original,
      sourceText: original,
      translatedText: english,
      sourceLabel: "한국어",
      translatedLabel: "English",
    };
  };

  const translateLearnerMessage = async (messageId: string, message: string) => {
    try {
      const learnerInput = await prepareLearnerInput(message);
      updateMessage(messageId, {
        text: learnerInput.displayText,
        sourceText: learnerInput.sourceText,
        translatedText: learnerInput.translatedText,
        sourceLabel: learnerInput.sourceLabel,
        translatedLabel: learnerInput.translatedLabel,
        translating: false,
      });
      return learnerInput.modelText;
    } catch (error) {
      toastError(error, "영어 번역을 만들지 못했습니다.");
      updateMessage(messageId, {
        translatedText: "번역 실패",
        translating: false,
      });
      return message;
    }
  };

  const translateAgentMessage = async (messageId: string, message: string) => {
    const original = message.trim();
    if (!autoKoEn || !original) return;

    updateMessage(messageId, {
      sourceText: original,
      sourceLabel: "English",
      translatedLabel: "한국어",
      translating: true,
    });

    try {
      const korean = (await withTranslationRetry(() => agentChatApi.translateToKorean(original))).text.trim();
      updateMessage(messageId, {
        sourceText: original,
        translatedText: korean,
        translating: false,
      });
    } catch (error) {
      toastError(error, "응답 번역을 만들지 못했습니다.");
      updateMessage(messageId, {
        translatedText: "번역 실패",
        translating: false,
      });
    }
  };

  const sendMessage = async () => {
    const message = input.trim();
    const imagesForSend = attachedImages;
    const hasAttachedImages = imagesForSend.length > 0;
    if (!agent || (!message && !hasAttachedImages) || sending) return;

    setInput("");
    setAttachedImages([]);
    setSending(true);
    const needsTranslation = autoKoEn && !!message;
    const learnerMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: learnerMessageId,
        role: "learner",
        text: needsTranslation ? "" : message || "이미지를 보냈습니다.",
        images: imagesForSend,
        sourceText: needsTranslation ? message : undefined,
        sourceLabel: needsTranslation ? (hasKorean(message) ? "한국어" : "English") : undefined,
        translatedLabel: needsTranslation ? (hasKorean(message) ? "English" : "한국어") : undefined,
        translating: needsTranslation,
      },
    ]);

    const modelText = needsTranslation
      ? await translateLearnerMessage(learnerMessageId, message)
      : message || "Please look at the attached image and respond naturally in character.";

    const dataChannel = dataChannelRef.current;
    if (!hasAttachedImages && voiceStatus === "connected" && dataChannel?.readyState === "open") {
      requestRealtimeResponse(modelText);
      setSending(false);
      return;
    }

    const agentResponseId = crypto.randomUUID();
    let responseText = "";

    // 호출 시점의 대화 히스토리(최대 20턴)를 직렬화 — 새 learner는 message로 따로 가므로 제외
    const pickText = (m: ChatMessage) => (m.sourceText ?? m.text ?? "").trim();
    const history = messages
      .slice(-20)
      .map<ChatTurn | null>((m) => {
        const content = pickText(m);
        if (!content) return null;
        return { role: m.role === "agent" ? "assistant" : "user", content };
      })
      .filter((t): t is ChatTurn => t !== null);

    setMessages((current) => [
      ...current,
      { id: agentResponseId, role: "agent", text: "", streaming: true },
    ]);

    try {
      if (hasAttachedImages) {
        const response = await agentChatApi.sendMessage({
          agentId: agent.id,
          message: modelText,
          instructions: buildEffectiveInstructions() || undefined,
          history,
          images: imagesForSend.map((image) => ({ dataUrl: image.dataUrl })),
        });
        const imageResponseText = normalizeSpokenReply(response.content);
        setMessages((current) =>
          current.map((item) =>
            item.id === agentResponseId ? { ...item, text: imageResponseText, streaming: false } : item
          )
        );
        void translateAgentMessage(agentResponseId, imageResponseText);
        if (autoSpeak) void speakMessage(agentResponseId, imageResponseText);
        return;
      } else {
        await agentChatApi.streamMessage({ agentId: agent.id, message: modelText, instructions: buildEffectiveInstructions() || undefined, history }, (delta) => {
          responseText += delta;
          setMessages((current) =>
            current.map((item) =>
              item.id === agentResponseId ? { ...item, text: `${item.text}${delta}` } : item
            )
          );
        });
      }
      const normalizedResponseText = normalizeSpokenReply(responseText);
      setMessages((current) =>
        current.map((item) =>
          item.id === agentResponseId ? { ...item, streaming: false, text: normalizedResponseText } : item
        )
      );
      void translateAgentMessage(agentResponseId, normalizedResponseText);
      if (autoSpeak) void speakMessage(agentResponseId, normalizedResponseText);
    } catch (e) {
      toastError(e, "AI 응답을 가져오지 못했습니다.");
      setMessages((current) =>
        current.map((item) =>
          item.id === agentResponseId
            ? {
                id: agentResponseId,
                role: "agent",
                streaming: false,
                text: "OpenAI 설정 또는 서버 연결을 확인해주세요. API 키가 없으면 실제 응답을 생성할 수 없습니다.",
              }
            : item
        )
      );
    } finally {
      setSending(false);
    }
  };

  const sendRealtimeResponseCreate = () => {
    const dataChannel = dataChannelRef.current;
    if (dataChannel?.readyState !== "open") return;
    realtimeResponseActiveRef.current = true;
    dataChannel.send(
      JSON.stringify({
        type: "response.create",
      })
    );
  };

  const flushPendingRealtimeMessage = () => {
    if (realtimeResponseActiveRef.current) return;
    const message = pendingRealtimeMessagesRef.current.shift();
    if (!message) return;

    const dataChannel = dataChannelRef.current;
    if (dataChannel?.readyState !== "open") {
      pendingRealtimeMessagesRef.current.unshift(message);
      return;
    }

    dataChannel.send(
      JSON.stringify({
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [{ type: "input_text", text: message }],
        },
      })
    );
    sendRealtimeResponseCreate();
  };

  const requestRealtimeResponse = (message: string) => {
    const trimmed = message.trim();
    if (!trimmed) return;
    scheduleRealtimeIdleTimeout();
    pendingRealtimeMessagesRef.current.push(trimmed);
    flushPendingRealtimeMessage();
  };

  const handleRealtimeResponseComplete = () => {
    realtimeResponseActiveRef.current = false;
    flushPendingRealtimeMessage();
  };

  const handleRealtimeError = (payload: RealtimePayload) => {
    if (payload.error?.code === "conversation_already_has_active_response") {
      realtimeResponseActiveRef.current = true;
      console.warn("Realtime response is already active; queued pending input.", payload);
      return;
    }

    const errorMessage = payload.error?.message ?? "Realtime 응답 생성 중 오류가 발생했습니다.";
    console.warn("Realtime error", payload);
    realtimeResponseActiveRef.current = false;
    flushPendingRealtimeMessage();
    toast.error(errorMessage);
  };

  const handleRealtimeTranscript = async (transcript: string) => {
    const original = transcript.trim();
    if (!original) return;
    scheduleRealtimeIdleTimeout();

    if (!autoKoEn) {
      appendLearnerMessage({ text: original });
      return;
    }

    const needsTranslation = autoKoEn;
    const learnerMessageId = crypto.randomUUID();
    setMessages((current) => [
      ...current,
      {
        id: learnerMessageId,
        role: "learner",
        text: needsTranslation ? "" : original,
        sourceText: needsTranslation ? original : undefined,
        sourceLabel: needsTranslation ? (hasKorean(original) ? "한국어" : "English") : undefined,
        translatedLabel: needsTranslation ? (hasKorean(original) ? "English" : "한국어") : undefined,
        translating: needsTranslation,
      },
    ]);

    const modelText = needsTranslation ? await translateLearnerMessage(learnerMessageId, original) : original;
    requestRealtimeResponse(modelText);
  };

  const startRealtimeSession = async (autoKoEnOverride = autoKoEn, force = false) => {
    if (!force && voiceStatus !== "idle") return;
    if (!agent) return;

    setVoiceStatus("connecting");
    try {
      const tokenResponse = await agentChatApi.createRealtimeClientSecret(agent.id, autoKoEnOverride, buildEffectiveInstructions() || undefined);
      const clientSecret = extractClientSecret(tokenResponse.raw);
      if (!clientSecret) throw new Error("Realtime client secret이 응답에 없습니다.");

      const pc = new RTCPeerConnection();
      peerRef.current = pc;
      pc.addTransceiver("audio", { direction: "recvonly" });

      const audio = document.createElement("audio");
      audio.autoplay = true;
      audio.setAttribute("playsinline", "true");
      audio.controls = false;
      audio.style.display = "none";
      document.body.appendChild(audio);
      audioRef.current = audio;
      pc.ontrack = (event) => {
        audio.srcObject = event.streams[0];
        void audio.play().catch(() => {
          toast.error("브라우저가 오디오 자동재생을 막았습니다. 음성 세션 버튼을 다시 눌러주세요.");
        });
      };

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: false,
        },
      });
      mediaStreamRef.current = stream;
      stream.getAudioTracks().forEach((track) => {
        track.enabled = !micMuted;
      });
      pc.addTrack(stream.getAudioTracks()[0]);

      const dataChannel = pc.createDataChannel("oai-events");
      dataChannelRef.current = dataChannel;
      dataChannel.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data) as RealtimePayload;
          const key = getRealtimeEventKey(payload);

          if (payload.type === "error") {
            handleRealtimeError(payload);
            return;
          }

          if (payload.type === "conversation.item.input_audio_transcription.completed") {
            void handleRealtimeTranscript(payload.transcript ?? "");
          }

          if (
            payload.type === "response.text.delta" ||
            payload.type === "response.output_text.delta" ||
            payload.type === "response.audio_transcript.delta" ||
            payload.type === "response.output_audio_transcript.delta"
          ) {
            appendRealtimeDelta(key, payload.delta ?? "");
          }

          if (
            payload.type === "response.text.done" ||
            payload.type === "response.output_text.done" ||
            payload.type === "response.audio_transcript.done" ||
            payload.type === "response.output_audio_transcript.done"
          ) {
            completedRealtimeItemsRef.current.add(key);
            finalizeRealtimeMessage(key, payload.transcript ?? payload.text ?? "");
          }

          if (payload.type === "response.done") {
            console.debug("Realtime response done", payload);
            if (!completedRealtimeItemsRef.current.has(key)) {
              const text = extractResponseText(payload.response);
              if (text) {
                completedRealtimeItemsRef.current.add(key);
                const messageId = `realtime-${key}`;
                appendRealtimeMessage("agent", text, { id: messageId });
                void translateAgentMessage(messageId, text);
              }
            }
            handleRealtimeResponseComplete();
          }
        } catch {
          console.debug("Realtime event", event.data);
        }
      });
      dataChannel.addEventListener("open", () => {
        sendRealtimeResponseCreate();
      });
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      const sdpResponse = await fetch("https://api.openai.com/v1/realtime/calls", {
        method: "POST",
        body: offer.sdp,
        headers: {
          Authorization: `Bearer ${clientSecret}`,
          "Content-Type": "application/sdp",
        },
      });

      if (!sdpResponse.ok) {
        throw new Error(`Realtime 연결 실패: ${sdpResponse.status}`);
      }

      await pc.setRemoteDescription({
        type: "answer",
        sdp: await sdpResponse.text(),
      });

      setVoiceStatus("connected");
      scheduleRealtimeIdleTimeout();
      toast.success("Realtime 음성 세션이 연결되었습니다.");
    } catch (e) {
      peerRef.current?.close();
      mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
      audioRef.current?.remove();
      peerRef.current = null;
      mediaStreamRef.current = null;
      audioRef.current = null;
      setVoiceStatus("idle");
      toastError(e, "Realtime 세션을 시작하지 못했습니다.");
    }
  };

  const toggleRealtimeSession = () => {
    if (voiceStatus === "connected") {
      stopRealtimeSession();
      return;
    }

    void startRealtimeSession();
  };

  const buildConversationSaveMessages = () =>
    messages
      .filter((message) => !message.streaming)
      .map((message, index) => ({
        role: message.role,
        messageOrder: index,
        text: message.text || undefined,
        sourceText: message.sourceText || undefined,
        translatedText: message.translatedText || undefined,
        sourceLabel: message.sourceLabel || undefined,
        translatedLabel: message.translatedLabel || undefined,
      }))
      .filter((message) =>
        [message.text, message.sourceText, message.translatedText].some((value) => value?.trim())
      );

  const saveCurrentConversation = async () => {
    if (!agent || savingConversation) return;
    const saveMessages = buildConversationSaveMessages();
    if (saveMessages.length === 0) {
      toast.info("저장할 대화가 없습니다.");
      return;
    }

    const firstLearner = messages.find((message) => message.role === "learner");
    const preview = firstLearner ? getConversationPreview(firstLearner) : getConversationPreview(messages[0]);
    const nowTitle = `${agent.title} 대화 ${new Intl.DateTimeFormat("ko-KR", {
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date())}`;

    setSavingConversation(true);
    try {
      const saved = await agentChatApi.createConversationSave({
        agentId: agent.id,
        agentTitle: agent.title,
        title: preview ? preview.slice(0, 80) : nowTitle,
        summary: preview ? `${agent.title} - ${preview.slice(0, 120)}` : undefined,
        messages: saveMessages,
      });
      setSavedConversations((current) => [
        {
          id: saved.id,
          agentId: saved.agentId,
          agentTitle: saved.agentTitle,
          title: saved.title,
          summary: saved.summary,
          messageCount: saved.messages.length,
          createdAt: saved.createdAt,
          updatedAt: saved.updatedAt,
        },
        ...current.filter((item) => item.id !== saved.id),
      ]);
      toast.success("대화 전체를 저장했습니다.");
    } catch (error) {
      toastError(error, "대화를 저장하지 못했습니다.");
    } finally {
      setSavingConversation(false);
    }
  };

  const loadConversationSaves = async () => {
    if (!agent) return;
    setSavedConversationsLoading(true);
    try {
      setSavedConversations(await agentChatApi.listConversationSaves(agent.id));
    } catch (error) {
      toastError(error, "저장된 대화 목록을 가져오지 못했습니다.");
    } finally {
      setSavedConversationsLoading(false);
    }
  };

  const openConversationSaves = async () => {
    setSavedListOpen(true);
    await loadConversationSaves();
  };

  const openHistorySidebar = () => {
    setSidebarTab("history");
    if (!savedConversations.length && !savedConversationsLoading) {
      void loadConversationSaves();
    }
  };

  const selectSavedConversation = async (saveId: number) => {
    setSelectedSavedConversationLoading(true);
    try {
      const detail = await agentChatApi.getConversationSave(saveId);
      setSelectedSavedConversation(detail);
      setSavedConversationNoteDraft(detail.note ?? "");
    } catch (error) {
      toastError(error, "저장된 대화를 가져오지 못했습니다.");
    } finally {
      setSelectedSavedConversationLoading(false);
    }
  };

  const saveConversationNote = async () => {
    if (!selectedSavedConversation || savingConversationNote) return;

    setSavingConversationNote(true);
    try {
      const saved = await agentChatApi.updateConversationSaveNote(
        selectedSavedConversation.id,
        savedConversationNoteDraft
      );
      setSelectedSavedConversation(saved);
      setSavedConversations((current) =>
        current.map((item) =>
          item.id === saved.id
            ? { ...item, note: saved.note, updatedAt: saved.updatedAt }
            : item
        )
      );
      toast.success("노트를 저장했습니다.");
    } catch (error) {
      toastError(error, "노트를 저장하지 못했습니다.");
    } finally {
      setSavingConversationNote(false);
    }
  };

  const deleteSavedConversation = async (saveId: number) => {
    if (!(await confirm({
      title: "저장 대화 삭제",
      description: "이 저장 대화를 삭제할까요?",
      confirmText: "삭제",
      variant: "destructive",
    }))) return;

    try {
      await agentChatApi.deleteConversationSave(saveId);
      setSavedConversations((current) => current.filter((item) => item.id !== saveId));
      setSelectedSavedConversation((current) => (current?.id === saveId ? null : current));
      if (selectedSavedConversation?.id === saveId) setSavedConversationNoteDraft("");
      toast.success("저장 대화를 삭제했습니다.");
    } catch (error) {
      toastError(error, "저장 대화를 삭제하지 못했습니다.");
    }
  };

  const clearChatMessages = () => {
    realtimeTextRef.current.clear();
    completedRealtimeItemsRef.current.clear();
    stopSpeaking();
    ttsCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    ttsCacheRef.current.clear();
    setMessages([]);
    setExpressionFeedback(null);
    setChunkAnalysis({});
    setOpenChunkId(null);
    toast.success("채팅 메시지를 지웠습니다.");
  };

  const requestExpressionFeedbackForText = async (text: string) => {
    const source = text.trim();
    if (!source) return;

    setSidebarTab("feedback");
    setExpressionFeedback({ source, content: "", loading: true });

    try {
      const response = await agentChatApi.getExpressionFeedback(source);
      setExpressionFeedback({ source, content: response.content, loading: false });
    } catch (error) {
      toastError(error, "표현 피드백을 가져오지 못했습니다.");
      setExpressionFeedback({
        source,
        content: "표현 피드백을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        loading: false,
      });
    }
  };

  const requestExpressionFeedback = (message: ChatMessage) => {
    void requestExpressionFeedbackForText(getExpressionSource(message));
  };

  const requestChunkAnalysis = async (messageId: string, text: string) => {
    const source = text.trim();
    if (!source) return;

    setOpenChunkId(messageId);

    const existing = chunkAnalysis[messageId];
    // 이미 분석됐거나 분석 중이면 다이얼로그만 다시 연다
    if (existing && (existing.loading || existing.data || existing.error)) return;

    setChunkAnalysis((current) => ({
      ...current,
      [messageId]: { loading: true, source },
    }));

    try {
      const data = await agentChatApi.analyzeChunks(source);
      setChunkAnalysis((current) => ({
        ...current,
        [messageId]: { loading: false, source, data },
      }));
    } catch (error) {
      toastError(error, "청크 분석을 가져오지 못했습니다.");
      setChunkAnalysis((current) => ({
        ...current,
        [messageId]: {
          loading: false,
          source,
          error: "청크 분석을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.",
        },
      }));
    }
  };

  const toggleExpressionVoiceInput = () => {
    if (expressionListening) {
      expressionRecognitionRef.current?.stop();
      setExpressionListening(false);
      return;
    }

    const SpeechRecognition =
      (window as SpeechRecognitionWindow).SpeechRecognition ??
      (window as SpeechRecognitionWindow).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      toast.error("이 브라우저는 보조 음성 입력을 지원하지 않습니다.");
      return;
    }

    const recognition = new SpeechRecognition();
    expressionRecognitionRef.current = recognition;
    recognition.lang = "ko-KR";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length })
        .map((_, index) => event.results[index][0]?.transcript)
        .filter(Boolean)
        .join(" ")
        .trim();
      if (transcript) setExpressionDraft((current) => (current ? `${current} ${transcript}` : transcript));
    };
    recognition.onerror = () => {
      toast.error("음성 입력을 인식하지 못했습니다.");
      setExpressionListening(false);
    };
    recognition.onend = () => {
      setExpressionListening(false);
    };
    setExpressionListening(true);
    recognition.start();
  };

  const checkExpressionDraft = () => {
    void requestExpressionFeedbackForText(expressionDraft);
  };

  const responseLengthControl = (compact = false) => (
    <div
      className={`inline-flex shrink-0 items-center gap-1 rounded-md border border-border bg-background p-1 ${
        compact ? "h-8" : "h-8"
      }`}
      title="AI 친구 답변의 기본 문장 수"
    >
      <span className="inline-flex items-center gap-1 px-1.5 text-xs font-semibold text-muted-foreground">
        <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
        {!compact && "응답 길이"}
      </span>
      <div className="flex items-center gap-1">
        {RESPONSE_LENGTH_PRESETS.map((preset) => {
          const active = responseLength === preset.value;
          return (
            <button
              key={preset.value}
              type="button"
              onClick={() => updateResponseLength(preset.value)}
              aria-pressed={active}
              className={`inline-flex h-6 min-w-8 items-center justify-center rounded px-1.5 text-[11px] font-bold transition-colors ${
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              }`}
            >
              {compact ? preset.shortLabel : preset.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!agent) {
    return (
      <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25">
        <div className="mx-auto flex min-h-[calc(100vh-3.5rem)] w-full max-w-7xl items-center justify-center px-4 py-4 sm:px-6">
          <div className="rounded-lg border border-border bg-background px-5 py-4 text-sm text-muted-foreground">
            에이전트 정보를 불러오는 중...
          </div>
        </div>
      </main>
    );
  }

  const accentClass = getAgentAccentClass(agent.id);
  const hasCustomInstructions = composeInstructions(instr).length > 0;

  return (
    <main className="min-h-[calc(100vh-3.5rem)] bg-muted/25">
      {variant === "mobile" ? (
        <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-md flex-col bg-background">
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-border px-3 py-2">
            <Link
              href="/dashboard"
              aria-label="대시보드로 돌아가기"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <button
              type="button"
              onClick={() => openSettings("character")}
              className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-1 py-1 text-left"
            >
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md border ${accentClass}`}>
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold">{agent.title}</h1>
                <p className="truncate text-xs text-muted-foreground">{voiceStatusText}</p>
              </div>
            </button>
            <button
              type="button"
              aria-label="캐릭터 설정"
              onClick={() => openSettings("character")}
              className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Settings2 className="h-4 w-4" />
            </button>
          </header>

          <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-border px-3 py-2">
            <button
              type="button"
              onClick={() => void requestSuggestedReply()}
              disabled={suggestingReply}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {suggestingReply ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <WandSparkles className="h-3.5 w-3.5" />}
              추천 답변
            </button>
            <button
              type="button"
              onClick={() => void saveCurrentConversation()}
              disabled={messages.length === 0 || sending || savingConversation}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
            >
              {savingConversation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              저장
            </button>
            <button
              type="button"
              onClick={() => void openConversationSaves()}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <History className="h-3.5 w-3.5" />
              목록
            </button>
            {responseLengthControl(true)}
            <button
              type="button"
              onClick={toggleRealtimeSession}
              disabled={voiceStatus === "connecting"}
              className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                voiceStatus === "connected"
                  ? "border-destructive/40 bg-destructive/10 text-destructive"
                  : "border-amber-300 bg-amber-50 text-amber-700"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {voiceStatus === "connected" ? "실시간 종료" : voiceStatus === "connecting" ? "연결 중" : "실시간"}
            </button>
            <label className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground">
              <Languages className="h-3.5 w-3.5 text-primary" />
              번역
              <Switch
                checked={autoKoEn}
                onCheckedChange={toggleAutoKoEn}
                disabled={voiceStatus === "connecting"}
                aria-label="자동 번역"
              />
            </label>
            <label className="inline-flex h-8 shrink-0 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground">
              <Volume2 className="h-3.5 w-3.5 text-primary" />
              읽기
              <Switch checked={autoSpeak} onCheckedChange={toggleAutoSpeak} aria-label="AI 답변 자동 읽기" />
            </label>
          </div>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-4">
            {messages.length === 0 && !sending && (
              <div className="flex min-h-full flex-col justify-center gap-4 text-center">
                <div>
                  <div className={`mx-auto flex h-12 w-12 items-center justify-center rounded-full border ${accentClass}`}>
                    <Bot className="h-6 w-6" />
                  </div>
                  <p className="mt-3 text-sm font-semibold">{agent.title}와 대화 시작</p>
                  <p className="mt-1 text-xs text-muted-foreground">{agent.sessionGoal}</p>
                </div>
                <div className="flex flex-col gap-2">
                  {agent.starterPrompts.slice(0, 3).map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => {
                        setInput(prompt);
                        textAreaRef.current?.focus();
                      }}
                      className="rounded-md border border-border px-3 py-2 text-left text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => {
              const isLearner = message.role === "learner";
              const isTyping = !isLearner && message.streaming && !message.text.trim() && !message.sourceText;
              const expressionSource = getExpressionSource(message);
              const chunkSource = getChunkAnalysisSource(message);

              return (
                <div key={message.id} className={`flex ${isLearner ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[86%] rounded-lg px-3 py-2 text-sm leading-6 ${
                      isLearner
                        ? "bg-primary text-primary-foreground"
                        : "border border-border bg-muted/35 text-foreground"
                      } whitespace-pre-wrap`}
                  >
                    {message.images?.length ? (
                      <div className="mb-2 flex flex-wrap gap-2 whitespace-normal">
                        {message.images.map((image) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={image.id}
                            src={image.dataUrl}
                            alt={image.name}
                            className="max-h-32 max-w-48 rounded-md border border-primary-foreground/20 object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                    {message.sourceText ? (
                      <div className="space-y-2 whitespace-normal">
                        <div>
                          <div className={`mb-1 text-[10px] font-semibold uppercase ${isLearner ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {message.sourceLabel ?? "원문"}
                          </div>
                          <div className="whitespace-pre-wrap">{message.sourceText}</div>
                        </div>
                        <div className={`border-t pt-2 ${isLearner ? "border-primary-foreground/20" : "border-border"}`}>
                          <div className={`mb-1 text-[10px] font-semibold uppercase ${isLearner ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                            {message.translatedLabel ?? "번역"}
                          </div>
                          <div className="whitespace-pre-wrap font-medium">
                            {message.translating ? "번역 중..." : message.translatedText}
                          </div>
                        </div>
                      </div>
                    ) : isTyping ? (
                      <TypingDots />
                    ) : (
                      message.text
                    )}

                    <div className={`mt-2 flex flex-wrap gap-1.5 border-t pt-2 ${isLearner ? "border-primary-foreground/20" : "border-border"}`}>
                      {expressionSource.trim() && (
                        <button
                          type="button"
                          onClick={() => void speakMessage(message.id, expressionSource)}
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold ${
                            isLearner
                              ? "bg-primary-foreground/10 text-primary-foreground/85"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {speakingMessageId === message.id ? <Square className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
                          {speakingMessageId === message.id ? "중지" : "듣기"}
                        </button>
                      )}
                      {isLearner && (
                        <button
                          type="button"
                          onClick={() => void requestExpressionFeedback(message)}
                          className="inline-flex h-7 items-center gap-1 rounded-md bg-primary-foreground/10 px-2 text-xs font-semibold text-primary-foreground/85"
                        >
                          <WandSparkles className="h-3.5 w-3.5" />
                          표현
                        </button>
                      )}
                      {chunkSource && (
                        <button
                          type="button"
                          onClick={() => void requestChunkAnalysis(message.id, chunkSource)}
                          disabled={chunkAnalysis[message.id]?.loading}
                          className={`inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-semibold disabled:opacity-60 ${
                            isLearner
                              ? "bg-primary-foreground/10 text-primary-foreground/85"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {chunkAnalysis[message.id]?.loading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ListTree className="h-3.5 w-3.5" />
                          )}
                          {chunkAnalysis[message.id]?.loading ? "분석 중" : "청크"}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {sending && !messages.some((m) => m.role === "agent" && m.streaming && !m.text.trim() && !m.sourceText) && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-muted/35 px-4 py-3">
                  <TypingDots />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} aria-hidden="true" />
          </div>

          {expressionFeedback && (
            <section className="shrink-0 border-t border-border bg-muted/20 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase text-primary">표현 피드백</p>
                  <p className="mt-1 max-h-[3.75rem] overflow-hidden whitespace-pre-wrap text-xs leading-5 text-muted-foreground">
                    {expressionFeedback.loading
                      ? "표현을 확인하는 중..."
                      : getExpressionSuggestions(expressionFeedback)[0] ?? expressionFeedback.content}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="표현 피드백 닫기"
                  onClick={() => setExpressionFeedback(null)}
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </section>
          )}

          <footer className="shrink-0 border-t border-border bg-background p-3">
            <div className="flex items-end gap-2 rounded-lg border border-border bg-muted/25 p-2">
              <textarea
                ref={textAreaRef}
                rows={1}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                    void sendMessage();
                  }
                }}
                placeholder="메시지 입력"
                className="max-h-28 min-h-10 flex-1 resize-none bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
              />
              <button
                type="button"
                aria-label={inputListening ? "녹음 중지" : "음성 입력"}
                onClick={toggleInputVoiceInput}
                disabled={inputTranscribing}
                className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md border transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  inputListening
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                {inputListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <button
                type="button"
                aria-label="메시지 전송"
                onClick={sendMessage}
                disabled={!input.trim() || sending}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </footer>
        </div>
      ) : (
        <div className="mx-auto flex h-[calc(100vh-3.5rem)] w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Link
            href="/dashboard"
            className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm font-medium transition-colors hover:bg-accent"
          >
            <ArrowLeft className="h-4 w-4" />
            대시보드
          </Link>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openSettings("character")}
              title="캐릭터 정보·근황 등 페르소나 설정"
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <Bot className="h-3.5 w-3.5" />
              캐릭터 설정
            </button>
            <div className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs font-semibold text-muted-foreground">
              <Volume2 className="h-4 w-4 text-primary" />
              {voiceStatusText}
            </div>
            <button
              type="button"
              onClick={toggleRealtimeSession}
              disabled={voiceStatus === "connecting"}
              title="OpenAI Realtime API 실시간 음성 대화 (사용량 과금이 큰 고급 모드입니다)"
              className={`inline-flex h-9 items-center gap-1.5 rounded-md border px-3 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                voiceStatus === "connected"
                  ? "border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
                  : "border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
              }`}
            >
              <Sparkles className="h-3.5 w-3.5" />
              {voiceStatus === "connected"
                ? "실시간 종료"
                : voiceStatus === "connecting"
                  ? "연결 중"
                  : "실시간 회화 (고급)"}
            </button>
          </div>
        </div>

        <section className="mb-4 rounded-lg border border-border bg-background px-4 py-3">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <button
              type="button"
              onClick={() => openSettings("character")}
              title="에이전트 지침(페르소나) 변경"
              className="group flex min-w-0 items-center gap-3 rounded-md text-left transition-colors hover:bg-accent/40"
            >
              <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-md border transition-transform group-hover:scale-105 ${accentClass}`}>
                <Bot className="h-5 w-5" />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background text-muted-foreground shadow-sm group-hover:text-primary">
                  <Settings2 className="h-2.5 w-2.5" />
                </span>
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-lg font-bold tracking-tight group-hover:text-primary">{agent.title}</h1>
                  <span className="text-xs font-semibold text-primary">{agent.subtitle}</span>
                  {hasCustomInstructions && (
                    <span className="rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
                      사용자 지침
                    </span>
                  )}
                </div>
                <p className="mt-1 truncate text-sm text-muted-foreground">{agent.sessionGoal}</p>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  AI 응답은 개인 OpenAI API 키가 필요합니다.
                  <Link href="/profile" className="font-semibold text-foreground underline-offset-4 hover:underline">
                    프로필에서 등록
                  </Link>
                </p>
              </div>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {responseLengthControl()}
              <label className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground">
                <Languages className="h-3.5 w-3.5 text-primary" />
                자동 번역
                <Switch
                  checked={autoKoEn}
                  onCheckedChange={toggleAutoKoEn}
                  disabled={voiceStatus === "connecting"}
                  aria-label="자동 번역"
                />
              </label>
              <label className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground">
                {micMuted ? <MicOff className="h-3.5 w-3.5 text-destructive" /> : <Mic className="h-3.5 w-3.5 text-primary" />}
                음소거
                <Switch
                  checked={micMuted}
                  onCheckedChange={toggleMicMuted}
                  disabled={voiceStatus === "connecting"}
                  aria-label="마이크 음소거"
                />
              </label>
              <label className="inline-flex h-8 items-center gap-2 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground">
                <Volume2 className="h-3.5 w-3.5 text-primary" />
                답변 읽기
                <Switch
                  checked={autoSpeak}
                  onCheckedChange={toggleAutoSpeak}
                  aria-label="AI 답변 자동 읽기"
                />
              </label>
            </div>
          </div>
        </section>

        <section className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1fr)_380px]">

          <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background">
            <header className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
              <div>
                <h2 className="text-lg font-bold tracking-tight">{agent.title} 채팅</h2>
                <p className="text-sm text-muted-foreground">
                  텍스트 채팅 + 음성 입력 + 답변 읽어주기(TTS)로 연습하세요. 실시간 음성 대화는 우상단 고급 버튼으로 사용할 수 있습니다.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <span
                  title={autoKoEn ? "한국어와 영어 입력에 번역을 함께 표시" : "입력 원문만 표시"}
                  className={`inline-flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold ${
                    autoKoEn
                      ? "border-primary/30 bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground"
                  }`}
                >
                  <Languages className="h-3.5 w-3.5" />
                  자동 번역
                </span>
                <button
                  type="button"
                  onClick={() => void saveCurrentConversation()}
                  disabled={messages.length === 0 || sending || savingConversation}
                  title="현재 대화 전체 저장"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {savingConversation ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  전체 저장
                </button>
                <button
                  type="button"
                  onClick={openHistorySidebar}
                  title="저장된 대화 목록"
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <History className="h-3.5 w-3.5" />
                  저장 목록
                </button>
                <button
                  type="button"
                  aria-label="채팅 메시지 지우기"
                  title="채팅 메시지 지우기"
                  onClick={clearChatMessages}
                  disabled={messages.length === 0 || sending}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5 pb-8">
              {messages.length === 0 && !sending && (
                <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-full border ${accentClass}`}>
                    <Bot className="h-6 w-6" />
                  </div>
                  <p className="text-sm text-muted-foreground">
                    아래 문장으로 시작하거나, 자유롭게 말을 걸어보세요.
                  </p>
                  <div className="flex max-w-md flex-wrap justify-center gap-2">
                    {agent.starterPrompts.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        onClick={() => {
                          setInput(prompt);
                          textAreaRef.current?.focus();
                        }}
                        className="inline-flex items-center rounded-full border border-border px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {messages.map((message) => {
                const isLearner = message.role === "learner";
                const isTyping =
                  !isLearner && message.streaming && !message.text.trim() && !message.sourceText;
                const expressionSource = getExpressionSource(message);
                const chunkSource = getChunkAnalysisSource(message);

                return (
                  <div
                    key={message.id}
                    className={`flex ${isLearner ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[78%] rounded-lg px-4 py-3 text-sm leading-6 ${
                        isLearner
                          ? "bg-primary text-primary-foreground"
                        : "border border-border bg-muted/35 text-foreground"
                      } whitespace-pre-wrap`}
                    >
                      {message.images?.length ? (
                        <div className="mb-3 flex flex-wrap gap-2 whitespace-normal">
                          {message.images.map((image) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              key={image.id}
                              src={image.dataUrl}
                              alt={image.name}
                              className="max-h-40 max-w-56 rounded-md border border-primary-foreground/20 object-cover"
                            />
                          ))}
                        </div>
                      ) : null}
                      {message.sourceText ? (
                        <div className="space-y-2 whitespace-normal">
                          <div>
                            <div
                              className={`mb-1 text-[10px] font-semibold uppercase ${
                                isLearner ? "text-primary-foreground/60" : "text-muted-foreground"
                              }`}
                            >
                              {message.sourceLabel ?? "원문"}
                            </div>
                            <div className="whitespace-pre-wrap">{message.sourceText}</div>
                          </div>
                          <div className={`border-t pt-2 ${isLearner ? "border-primary-foreground/20" : "border-border"}`}>
                            <div
                              className={`mb-1 text-[10px] font-semibold uppercase ${
                                isLearner ? "text-primary-foreground/60" : "text-muted-foreground"
                              }`}
                            >
                              {message.translatedLabel ?? "번역"}
                            </div>
                            <div className="whitespace-pre-wrap font-medium">
                              {message.translating ? "번역 중..." : message.translatedText}
                            </div>
                          </div>
                        </div>
                      ) : isTyping ? (
                        <TypingDots />
                      ) : (
                        message.text
                      )}
                      {isLearner && (
                        <div className="mt-3 flex flex-wrap gap-2 border-t border-primary-foreground/20 pt-2">
                          <button
                            type="button"
                            onClick={() => void requestExpressionFeedback(message)}
                            className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary-foreground/10 px-2 text-xs font-semibold text-primary-foreground/85 transition-colors hover:bg-primary-foreground/20"
                          >
                            <WandSparkles className="h-3.5 w-3.5" />
                            자연스러운 표현
                          </button>
                          {expressionSource && (
                            <button
                              type="button"
                              onClick={() => void speakMessage(message.id, expressionSource)}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary-foreground/10 px-2 text-xs font-semibold text-primary-foreground/85 transition-colors hover:bg-primary-foreground/20"
                            >
                              {speakingMessageId === message.id ? (
                                <>
                                  <Square className="h-3.5 w-3.5" />
                                  중지
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-3.5 w-3.5" />
                                  듣기
                                </>
                              )}
                            </button>
                          )}
                          {chunkSource && (
                            <button
                              type="button"
                              onClick={() => void requestChunkAnalysis(message.id, chunkSource)}
                              disabled={chunkAnalysis[message.id]?.loading}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary-foreground/10 px-2 text-xs font-semibold text-primary-foreground/85 transition-colors hover:bg-primary-foreground/20 disabled:opacity-60"
                            >
                              {chunkAnalysis[message.id]?.loading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  분석 중
                                </>
                              ) : (
                                <>
                                  <ListTree className="h-3.5 w-3.5" />
                                  청크 분석
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      )}
                      {!isLearner && !message.streaming && chunkSource && (
                        <div className="mt-3 border-t border-border pt-2">
                          <div className="flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => void speakMessage(message.id, chunkSource)}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            >
                              {speakingMessageId === message.id ? (
                                <>
                                  <Square className="h-3.5 w-3.5" />
                                  중지
                                </>
                              ) : (
                                <>
                                  <Volume2 className="h-3.5 w-3.5" />
                                  듣기
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => void requestChunkAnalysis(message.id, chunkSource)}
                              disabled={chunkAnalysis[message.id]?.loading}
                              className="inline-flex h-7 items-center gap-1.5 rounded-md bg-muted px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
                            >
                              {chunkAnalysis[message.id]?.loading ? (
                                <>
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  분석 중
                                </>
                              ) : (
                                <>
                                  <ListTree className="h-3.5 w-3.5" />
                                  청크 분석
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
              {sending &&
                !messages.some(
                  (m) => m.role === "agent" && m.streaming && !m.text.trim() && !m.sourceText
                ) && (
                  <div className="flex justify-start">
                    <div className="rounded-lg border border-border bg-muted/35 px-4 py-3">
                      <TypingDots />
                    </div>
                  </div>
                )}
              <div ref={messagesEndRef} aria-hidden="true" />
            </div>

            <footer className="border-t border-border p-4">
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => void handleImageFiles(event.target.files)}
              />
              <div className="mb-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  title="대화 흐름에 맞춰 다음에 내가 할 영어 답변을 한 줄 추천받습니다 (입력창에 채워짐)"
                  onClick={() => void requestSuggestedReply()}
                  disabled={suggestingReply}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {suggestingReply ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <WandSparkles className="h-3.5 w-3.5" />
                  )}
                  {suggestingReply ? "추천 중..." : "추천 답변"}
                </button>
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                  이미지
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setInput("Let's talk about something casual from daily life.");
                    textAreaRef.current?.focus();
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  가벼운 대화
                </button>
              </div>

              {attachedImages.length > 0 && (
                <div className="mb-3 flex flex-wrap gap-2">
                  {attachedImages.map((image) => (
                    <div key={image.id} className="group relative h-20 w-20 overflow-hidden rounded-md border border-border bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={image.dataUrl} alt={image.name} className="h-full w-full object-cover" />
                      <button
                        type="button"
                        aria-label={`${image.name} 첨부 제거`}
                        onClick={() => removeAttachedImage(image.id)}
                        className="absolute right-1 top-1 inline-flex h-6 w-6 items-center justify-center rounded-md bg-background/90 text-muted-foreground shadow-sm transition-colors hover:text-foreground"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {(inputListening || inputTranscribing) && (
                <div className="mb-2 flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className={`h-2 w-2 shrink-0 rounded-full ${
                        inputTranscribing ? "bg-primary" : inputAudioLevel > 0.08 ? "bg-destructive" : "bg-muted-foreground/40"
                      }`}
                    />
                    <span className="font-semibold text-foreground">
                      {inputTranscribing ? "음성 인식 중" : `녹음 중 ${formatRecordingDuration(inputRecordingMs)}`}
                    </span>
                    <span className="hidden truncate sm:inline">
                      {inputTranscribing
                        ? "말한 내용을 입력창으로 옮기고 있습니다."
                        : inputAudioLevel > 0.08
                          ? "음성이 들어오고 있습니다."
                          : "마이크 입력이 작습니다."}
                    </span>
                  </div>
                  <div className="flex h-5 shrink-0 items-end gap-0.5" aria-hidden="true">
                    {Array.from({ length: 14 }).map((_, index) => {
                      const active = inputListening && inputAudioLevel * 14 > index;
                      const height = 4 + ((index % 5) + 1) * 3;
                      return (
                        <span
                          key={index}
                          className={`w-1 rounded-full transition-colors ${active ? "bg-destructive" : "bg-muted"}`}
                          style={{ height }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-2">
                <textarea
                  ref={textAreaRef}
                  rows={2}
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      void sendMessage();
                    }
                  }}
                  placeholder="영어나 한국어로 편하게 답변해보세요. (⌘/Ctrl + Enter 전송)"
                  className="min-h-12 flex-1 resize-none self-stretch bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground"
                />
                <div className="flex shrink-0 flex-col gap-2 self-stretch">
                  <button
                    type="button"
                    aria-label={inputListening ? "녹음 중지" : inputTranscribing ? "음성 인식 중" : "음성 입력"}
                    onClick={toggleInputVoiceInput}
                    disabled={inputTranscribing}
                    title="마이크로 영어를 말하면 OpenAI 음성 인식으로 받아써 줍니다"
                    className={`inline-flex h-9 w-16 items-center justify-center gap-1 rounded-md border text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                      inputListening
                        ? "border-destructive/40 bg-destructive/10 text-destructive"
                        : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    {inputTranscribing ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        인식
                      </>
                    ) : inputListening ? (
                      <>
                        <MicOff className="h-3.5 w-3.5" />
                        중지
                      </>
                    ) : (
                      <Mic className="h-4 w-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    aria-label="메시지 전송"
                    onClick={sendMessage}
                    disabled={(!input.trim() && attachedImages.length === 0) || sending}
                    className="inline-flex h-11 w-16 items-center justify-center gap-1.5 rounded-md bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Send className="h-4 w-4" />
                    전송
                  </button>
                </div>
              </div>
            </footer>
          </section>

          <aside className="flex min-h-[320px] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-background xl:min-h-0">
            <header className="border-b border-border px-4 pt-3">
              <h2 className="text-base font-bold tracking-tight">학습 도구</h2>
              <div className="mt-3 grid grid-cols-3 gap-1 rounded-md border border-border bg-muted p-1">
                {[
                  { key: "koen", label: "한영 모드" },
                  { key: "history", label: "히스토리" },
                  { key: "feedback", label: "피드백" },
                ].map((tab) => {
                  const active = sidebarTab === tab.key;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => {
                        setSidebarTab(tab.key as SidebarTab);
                        if (tab.key === "history" && !savedConversations.length && !savedConversationsLoading) {
                          void loadConversationSaves();
                        }
                      }}
                      className={`h-8 rounded px-2 text-xs font-semibold transition-colors ${
                        active
                          ? "bg-foreground text-background shadow-sm"
                          : "text-muted-foreground hover:bg-background/70 hover:text-foreground"
                      }`}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </header>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {sidebarTab === "koen" && (
                <div className="space-y-3">
                  <div className="rounded-lg border border-border bg-muted/25 p-3">
                    <p className="text-[10px] font-semibold uppercase text-muted-foreground">Draft</p>
                    <textarea
                      rows={5}
                      value={expressionDraft}
                      onChange={(event) => setExpressionDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          checkExpressionDraft();
                        }
                      }}
                      placeholder="한국어로 먼저 말하고 싶은 내용을 적거나 음성으로 입력해보세요."
                      className="mt-2 min-h-32 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                    />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={checkExpressionDraft}
                        disabled={!expressionDraft.trim() || expressionFeedback?.loading}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md bg-primary px-2.5 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <WandSparkles className="h-3.5 w-3.5" />
                        표현 확인
                      </button>
                      <button
                        type="button"
                        onClick={toggleExpressionVoiceInput}
                        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                      >
                        {expressionListening ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
                        {expressionListening ? "중지" : "음성 입력"}
                      </button>
                    </div>
                  </div>
                  <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                    먼저 한국어로 생각을 정리한 뒤 표현 확인을 누르면 피드백 탭에서 자연스러운 영어 표현을 고를 수 있습니다.
                  </div>
                </div>
              )}

              {sidebarTab === "history" && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">저장된 대화</p>
                    <button
                      type="button"
                      onClick={() => void loadConversationSaves()}
                      disabled={savedConversationsLoading}
                      className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
                    >
                      {savedConversationsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <History className="h-3.5 w-3.5" />}
                      새로고침
                    </button>
                  </div>

                  {savedConversationsLoading ? (
                    <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      저장 목록을 불러오는 중...
                    </div>
                  ) : savedConversations.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                      아직 저장된 대화가 없습니다. 채팅 상단의 전체 저장을 누르면 여기에 표시됩니다.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {savedConversations.map((item) => {
                        const active = selectedSavedConversation?.id === item.id;
                        return (
                          <button
                            key={item.id}
                            type="button"
                            onClick={() => void selectSavedConversation(item.id)}
                            className={`w-full rounded-lg border p-3 text-left transition-colors ${
                              active ? "border-primary bg-primary/5" : "border-border bg-background hover:bg-accent/50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="min-w-0 truncate text-sm font-semibold">{item.title}</p>
                              <span className="shrink-0 text-[11px] text-muted-foreground">
                                {formatConversationSavedAt(item.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                              {item.summary || `${item.messageCount}개 메시지`}
                            </p>
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {selectedSavedConversation && (
                    <div className="rounded-lg border border-border bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-bold">{selectedSavedConversation.title}</p>
                        <button
                          type="button"
                          onClick={() => setSavedListOpen(true)}
                          className="shrink-0 text-xs font-semibold text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                        >
                          크게 보기
                        </button>
                      </div>
                      {selectedSavedConversationLoading ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          불러오는 중...
                        </div>
                      ) : (
                        <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                          {selectedSavedConversation.messages.slice(-8).map((message) => {
                            const isLearner = message.role === "learner";
                            return (
                              <div
                                key={message.id}
                                className={`rounded-md px-3 py-2 text-xs leading-5 ${
                                  isLearner ? "bg-primary text-primary-foreground" : "border border-border bg-background"
                                }`}
                              >
                                <p className="whitespace-pre-wrap">
                                  {(message.sourceText || message.text || message.translatedText || "").trim()}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {sidebarTab === "feedback" && (
                <div className="space-y-4">
                  {!expressionFeedback ? (
                    <div className="rounded-lg border border-dashed border-border bg-background p-4 text-sm leading-6 text-muted-foreground">
                      한영 모드에서 표현 확인을 누르거나, 대화 메시지 아래의 자연스러운 표현 버튼을 눌러보세요.
                    </div>
                  ) : (
                    <>
                      <div className="rounded-lg border border-border bg-muted/25 p-3">
                        <p className="text-[10px] font-semibold uppercase text-muted-foreground">Selected sentence</p>
                        <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6">{expressionFeedback.source}</p>
                      </div>

                      {expressionFeedback.loading ? (
                        <div className="rounded-lg border border-border bg-background p-3 text-sm text-muted-foreground">
                          표현을 확인하는 중...
                        </div>
                      ) : getExpressionSuggestions(expressionFeedback).length > 0 ? (
                        <>
                          <div className="space-y-2">
                            <p className="text-[10px] font-semibold uppercase text-primary">추천 표현</p>
                            {getExpressionSuggestions(expressionFeedback).map((suggestion, index) => (
                              <div key={`${index}-${suggestion}`} className="rounded-lg border border-border bg-background p-3">
                                <p className="text-sm font-medium leading-6">{suggestion}</p>
                                <div className="mt-2 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void speakMessage(suggestion, suggestion)}
                                    className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-xs font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                                  >
                                    {speakingMessageId === suggestion ? (
                                      <>
                                        <Square className="h-3.5 w-3.5" />
                                        중지
                                      </>
                                    ) : (
                                      <>
                                        <Volume2 className="h-3.5 w-3.5" />
                                        듣기
                                      </>
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setInput(suggestion);
                                      textAreaRef.current?.focus();
                                    }}
                                    className="inline-flex h-7 items-center gap-1.5 rounded-md bg-primary px-2 text-xs font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                                  >
                                    <Send className="h-3.5 w-3.5" />
                                    바로 입력
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>

                          {getExpressionReason(expressionFeedback) && (
                            <details className="rounded-lg border border-border bg-muted/20 p-3">
                              <summary className="cursor-pointer text-[10px] font-semibold uppercase text-muted-foreground">
                                왜 더 자연스러운가
                              </summary>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                                {getExpressionReason(expressionFeedback)}
                              </p>
                            </details>
                          )}
                        </>
                      ) : (
                        <div className="rounded-lg border border-border bg-background p-3">
                          <p className="text-[10px] font-semibold uppercase text-muted-foreground">Feedback</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-6">{expressionFeedback.content}</p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </aside>
        </section>
      </div>
      )}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="flex h-[88vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="text-base font-bold tracking-tight">에이전트 지침 설정</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  이 세션에만 적용되는 개인 지침입니다. 텍스트 채팅은 다음 메시지부터, 실시간 음성은 즉시 반영됩니다.
                </p>
              </div>
              <button
                type="button"
                aria-label="닫기"
                onClick={() => setSettingsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="flex min-h-0 flex-1">
              <nav className="w-56 shrink-0 space-y-1 overflow-y-auto border-r border-border p-3">
                {INSTRUCTION_TABS.map((tab) => {
                  const active = settingsTab === tab.key;
                  const filled = instrDraft[tab.key].trim().length > 0;
                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setSettingsTab(tab.key)}
                      className={`flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm font-semibold transition-colors ${
                        active
                          ? "bg-primary/10 text-primary"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                    >
                      <span className="truncate">{tab.label}</span>
                      {filled && (
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? "bg-primary" : "bg-primary/50"}`}
                          aria-label="작성됨"
                        />
                      )}
                    </button>
                  );
                })}
              </nav>

              <div className="flex min-h-0 flex-1 flex-col p-5">
                {INSTRUCTION_TABS.filter((tab) => tab.key === settingsTab).map((tab) => (
                  <div key={tab.key} className="relative flex min-h-0 flex-1 flex-col">
                    <div className="mb-3 flex items-center justify-between gap-2">
                      <h3 className="text-sm font-bold">{tab.label}</h3>
                      <div className="flex items-center gap-1.5">
                        {tab.key === "news" && (
                          <button
                            type="button"
                            onClick={() => {
                              setNewsQuery("");
                              setNewsPromptOpen(true);
                            }}
                            disabled={newsLoading}
                            title="관심 분야·키워드로 뉴스를 검색해 가져옵니다"
                            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Newspaper className="h-3.5 w-3.5" />
                            뉴스 검색해 가져오기
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={exportInstructionsXlsx}
                          title="작성한 6개 항목을 엑셀(.xlsx)로 내보냅니다"
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
                        >
                          <Download className="h-3.5 w-3.5" />
                          엑셀
                        </button>
                        <button
                          type="button"
                          onClick={() => xlsxInputRef.current?.click()}
                          title="엑셀(.xlsx)을 불러와 6개 항목을 채웁니다"
                          className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-background px-2 text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:border-primary hover:text-foreground"
                        >
                          <Upload className="h-3.5 w-3.5" />
                          불러오기
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={instrDraft[tab.key]}
                      onChange={(event) => setInstrDraft((draft) => ({ ...draft, [tab.key]: event.target.value }))}
                      placeholder={tab.placeholder}
                      className="min-h-0 flex-1 w-full resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground"
                    />
                  </div>
                ))}
                <p className="mt-3 shrink-0 text-xs text-muted-foreground">
                  여섯 항목은 하나의 지침으로 합쳐 적용됩니다. 모두 비우면 이 에이전트의 기본 지침을 사용합니다.
                </p>
              </div>
            </div>

            <footer className="flex items-center justify-between gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                onClick={async () => {
                  const hasAny = Object.values(instrDraft).some((v) => v.trim());
                  if (hasAny && !(await confirm({
                    title: "전체 비우기",
                    description: "작성한 6개 항목을 모두 비울까요?",
                    confirmText: "비우기",
                    variant: "destructive",
                  }))) return;
                  setInstrDraft(EMPTY_INSTRUCTIONS);
                }}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-dashed border-border px-3 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                전체 비우기
              </button>
              <div className="flex items-center gap-2">
                <input
                  ref={xlsxInputRef}
                  type="file"
                  accept=".xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) importInstructionsXlsx(file);
                    event.target.value = "";
                  }}
                />
                <button
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={saveSettings}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
                >
                  <Settings2 className="h-4 w-4" />
                  저장
                </button>
              </div>
            </footer>
          </div>
        </div>
      )}

      {newsPromptOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4"
          onClick={() => !newsLoading && setNewsPromptOpen(false)}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-xl border border-border bg-background shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="flex items-center justify-between border-b border-border px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                  <Newspaper className="h-4 w-4 text-primary" />
                  뉴스 검색
                </h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  관심 분야나 키워드를 입력하면 관련 뉴스를 가져옵니다. 비우면 오늘의 헤드라인을 가져옵니다.
                </p>
              </div>
              <button
                type="button"
                aria-label="닫기"
                disabled={newsLoading}
                onClick={() => setNewsPromptOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="p-5">
              <input
                autoFocus
                value={newsQuery}
                onChange={(event) => setNewsQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !newsLoading) loadNews(newsQuery);
                }}
                placeholder="예: 손흥민, 인공지능, 클라이밍, 우주 탐사"
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground"
              />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {["AI", "스포츠", "K-pop", "경제", "여행"].map((kw) => (
                  <button
                    key={kw}
                    type="button"
                    disabled={newsLoading}
                    onClick={() => setNewsQuery(kw)}
                    className="inline-flex h-7 items-center rounded-full border border-border bg-background px-3 text-xs font-medium text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:opacity-50"
                  >
                    {kw}
                  </button>
                ))}
              </div>
            </div>

            <footer className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
              <button
                type="button"
                disabled={newsLoading}
                onClick={() => setNewsPromptOpen(false)}
                className="inline-flex h-9 items-center rounded-md border border-border px-3 text-sm font-semibold text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={newsLoading}
                onClick={() => loadNews(newsQuery)}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {newsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Newspaper className="h-4 w-4" />}
                {newsLoading ? "검색 중..." : newsQuery.trim() ? "검색해 가져오기" : "오늘 헤드라인 가져오기"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {savedListOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-3"
          onClick={() => setSavedListOpen(false)}
        >
          <div
            className="relative grid h-[calc(100vh-1.5rem)] w-[calc(100vw-1.5rem)] overflow-hidden rounded-xl border border-border bg-background shadow-xl lg:grid-cols-[340px_minmax(0,1fr)_380px]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              aria-label="저장된 대화 닫기"
              onClick={() => setSavedListOpen(false)}
              className="absolute right-4 top-4 z-10 inline-flex h-8 w-8 items-center justify-center rounded-md bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
            <section className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <div>
                  <h2 className="flex items-center gap-2 text-base font-bold tracking-tight">
                    <History className="h-4 w-4 text-primary" />
                    저장된 대화
                  </h2>
                  <p className="mt-0.5 text-xs text-muted-foreground">{agent.title}에서 저장한 대화 목록입니다.</p>
                </div>
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {savedConversationsLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    저장 목록을 불러오는 중...
                  </div>
                ) : savedConversations.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-border bg-background p-5 text-sm text-muted-foreground">
                    아직 저장된 대화가 없습니다.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {savedConversations.map((item) => {
                      const active = selectedSavedConversation?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void selectSavedConversation(item.id)}
                          className={`w-full rounded-lg border p-3 text-left transition-colors ${
                            active
                              ? "border-primary bg-primary/5"
                              : "border-border bg-background hover:bg-accent/50"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold">{item.title}</p>
                              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                                {item.summary || `${item.messageCount}개 메시지`}
                              </p>
                            </div>
                            <span className="shrink-0 text-[11px] font-semibold text-muted-foreground">
                              {formatConversationSavedAt(item.createdAt)}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
              <header className="flex items-center justify-between border-b border-border px-5 py-4">
                <div className="min-w-0">
                  <h3 className="truncate text-sm font-bold">
                    {selectedSavedConversation?.title ?? "대화 상세"}
                  </h3>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {selectedSavedConversation
                      ? `${selectedSavedConversation.messages.length}개 메시지 · ${formatConversationSavedAt(selectedSavedConversation.createdAt)}`
                      : "목록에서 저장된 대화를 선택하세요."}
                  </p>
                </div>
                {selectedSavedConversation && (
                  <button
                    type="button"
                    onClick={() => void deleteSavedConversation(selectedSavedConversation.id)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-semibold text-muted-foreground transition-colors hover:border-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    삭제
                  </button>
                )}
              </header>

              <div className="min-h-0 flex-1 overflow-y-auto p-5">
                {selectedSavedConversationLoading ? (
                  <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/25 p-4 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    대화를 불러오는 중...
                  </div>
                ) : selectedSavedConversation ? (
                  <div className="space-y-4">
                    {selectedSavedConversation.messages.map((message) => {
                      const isLearner = message.role === "learner";
                      return (
                        <div key={message.id} className={`flex ${isLearner ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[82%] rounded-lg px-4 py-3 text-sm leading-6 ${
                              isLearner
                                ? "bg-primary text-primary-foreground"
                                : "border border-border bg-muted/35 text-foreground"
                            }`}
                          >
                            {message.sourceText ? (
                              <div className="space-y-2">
                                <div>
                                  <div className={`mb-1 text-[10px] font-semibold uppercase ${isLearner ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                    {message.sourceLabel ?? "원문"}
                                  </div>
                                  <div className="whitespace-pre-wrap">{message.sourceText}</div>
                                </div>
                                <div className={`border-t pt-2 ${isLearner ? "border-primary-foreground/20" : "border-border"}`}>
                                  <div className={`mb-1 text-[10px] font-semibold uppercase ${isLearner ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                                    {message.translatedLabel ?? "번역"}
                                  </div>
                                  <div className="whitespace-pre-wrap font-medium">{message.translatedText}</div>
                                </div>
                              </div>
                            ) : (
                              <div className="whitespace-pre-wrap">{message.text}</div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                    저장된 대화를 선택하면 전체 메시지를 볼 수 있습니다.
                  </div>
                )}
              </div>
            </section>

            <section className="flex min-h-0 min-w-0 flex-col">
              <header className="border-b border-border px-5 py-4">
                <h3 className="text-sm font-bold">노트 정리</h3>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  대화에서 기억할 표현, 오류, 다음 복습 내용을 정리하세요.
                </p>
              </header>

              <div className="flex min-h-0 flex-1 flex-col p-4">
                {selectedSavedConversation ? (
                  <>
                    <textarea
                      value={savedConversationNoteDraft}
                      onChange={(event) => setSavedConversationNoteDraft(event.target.value)}
                      placeholder={`예:
- Tokenmaxxing은 신조어라 번역하지 말고 그대로 이해
- "Could you..."로 부드럽게 질문하기
- 다음에는 Meta 관련 표현 복습`}
                      className="min-h-0 flex-1 resize-none rounded-md border border-border bg-background px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
                    />
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">
                        {savedConversationNoteDraft.trim().length}자
                      </span>
                      <button
                        type="button"
                        onClick={() => void saveConversationNote()}
                        disabled={savingConversationNote}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {savingConversationNote ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        노트 저장
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="flex min-h-40 flex-1 items-center justify-center rounded-lg border border-dashed border-border text-center text-sm leading-6 text-muted-foreground">
                    저장된 대화를 선택하면<br />오른쪽에 노트를 작성할 수 있습니다.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
      )}

      <ChunkAnalysisDialog
        open={openChunkId !== null}
        state={openChunkId ? chunkAnalysis[openChunkId] : undefined}
        onClose={() => setOpenChunkId(null)}
        onSpeak={(messageId, text) => void speakMessage(messageId, text)}
        speakingMessageId={speakingMessageId}
      />
      {confirmDialog}
    </main>
  );
}
