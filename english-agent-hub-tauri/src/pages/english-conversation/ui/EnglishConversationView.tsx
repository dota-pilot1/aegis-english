import type { FormEvent, RefObject } from "react";
import type { Agent } from "../../../entities/agent/model/types";
import type { Message } from "../../../entities/chat/model/types";
import type { UserSummary } from "../../../entities/user/model/types";
import {
  Bot,
  CheckCircle2,
  CircleAlert,
  History as HistoryIcon,
  Image as ImageIcon,
  KeyRound,
  Languages,
  Loader2,
  Mic,
  Paperclip,
  Save,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  WandSparkles,
} from "lucide-react";

type SidebarTab = "koen" | "history" | "feedback";
type ResponseLength = "1-3" | "3-4" | "4-5";

type EnglishConversationViewProps = {
  agents: Agent[];
  selectedAgent: Agent;
  selectedAgentId: string;
  messages: Message[];
  input: string;
  image: { name: string; dataUrl: string } | null;
  sending: boolean;
  connectionStatus: "checking" | "online" | "offline";
  autoTranslate: boolean;
  responseLength: ResponseLength;
  sidebarTab: SidebarTab;
  draftKo: string;
  feedback: string[];
  history: Message[][];
  error: string;
  user: UserSummary;
  starterPrompts: string[];
  fileRef: RefObject<HTMLInputElement | null>;
  endRef: RefObject<HTMLDivElement | null>;
  onSelectAgent: (agentId: string) => void;
  onSetInput: (input: string) => void;
  onSetImage: (image: { name: string; dataUrl: string } | null) => void;
  onSetAutoTranslate: (value: boolean) => void;
  onSetResponseLength: (length: ResponseLength) => void;
  onSetSidebarTab: (tab: SidebarTab) => void;
  onSetDraftKo: (draft: string) => void;
  onSetMessages: (messages: Message[]) => void;
  onSendMessage: (event: FormEvent<HTMLFormElement>) => void;
  onAttachImage: (files: FileList | null) => void;
  onBuildFeedback: () => void;
  onSaveSession: () => void;
};

export function EnglishConversationView({
  agents,
  selectedAgent,
  selectedAgentId,
  messages,
  input,
  image,
  sending,
  connectionStatus,
  autoTranslate,
  responseLength,
  sidebarTab,
  draftKo,
  feedback,
  history,
  error,
  user,
  starterPrompts,
  fileRef,
  endRef,
  onSelectAgent,
  onSetInput,
  onSetImage,
  onSetAutoTranslate,
  onSetResponseLength,
  onSetSidebarTab,
  onSetDraftKo,
  onSetMessages,
  onSendMessage,
  onAttachImage,
  onBuildFeedback,
  onSaveSession,
}: EnglishConversationViewProps) {
  return (
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
              className={`agent-card ${selectedAgentId === agent.id ? "active" : ""}`}
              onClick={() => onSelectAgent(agent.id)}
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
                onClick={() => onSetResponseLength(length)}
              >
                {length}
              </button>
            ))}
            <button
              className={autoTranslate ? "selected" : ""}
              onClick={() => onSetAutoTranslate(!autoTranslate)}
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
                  <button key={prompt} onClick={() => onSetInput(prompt)}>{prompt}</button>
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

        <form className="composer" onSubmit={onSendMessage}>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(event) => onAttachImage(event.target.files)} />
          <div className="quick-actions">
            <button type="button" onClick={() => onSetInput("Can you help me say this naturally in English?")}>
              <WandSparkles size={15} />
              추천 답변
            </button>
            <button type="button" onClick={() => fileRef.current?.click()}>
              <ImageIcon size={15} />
              이미지
            </button>
            <button type="button" onClick={() => onSetInput("Let's talk about something casual from daily life.")}>
              <Paperclip size={15} />
              가벼운 대화
            </button>
          </div>

          {image && (
            <div className="attached-image">
              <img src={image.dataUrl} alt={image.name} />
              <span>{image.name}</span>
              <button type="button" onClick={() => onSetImage(null)}>삭제</button>
            </div>
          )}

          {error && <div className="error">{error}</div>}

          <div className="input-row">
            <textarea
              value={input}
              onChange={(event) => onSetInput(event.target.value)}
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
              onClick={() => onSetSidebarTab(key as SidebarTab)}
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
              onChange={(event) => onSetDraftKo(event.target.value)}
              placeholder="한국어로 먼저 말하고 싶은 내용을 적어보세요."
              rows={7}
            />
            <div className="tool-actions">
              <button onClick={onBuildFeedback}><Sparkles size={15} /> 표현 확인</button>
              <button><Mic size={15} /> 음성 입력</button>
            </div>
          </section>
        )}

        {sidebarTab === "history" && (
          <section className="tool-body history-list">
            <button className="save-session" onClick={onSaveSession} disabled={messages.length === 0}>
              <Save size={15} />
              현재 대화 저장
            </button>
            {history.length === 0 ? (
              <p className="muted">저장된 대화가 없습니다.</p>
            ) : history.map((session, index) => (
              <button key={index} onClick={() => onSetMessages(session)}>
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
                <button onClick={() => onSetInput(item)}><Send size={14} /> 바로 입력</button>
                <button><Volume2 size={14} /> 듣기</button>
              </div>
            ))}
          </section>
        )}
      </aside>
    </section>
  );
}
