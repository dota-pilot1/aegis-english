import { FormEvent, useEffect, useState } from "react";
import { Bot, Eye, EyeOff, Loader2, LogIn } from "lucide-react";

type LoginScreenProps = {
  onLogin: (email: string, password: string) => Promise<void>;
};

export function LoginScreen({ onLogin }: LoginScreenProps) {
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
