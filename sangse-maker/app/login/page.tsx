"use client";

import { useEffect, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { supabaseBrowser } from "@/lib/supabase/client";
import { SIGNUP_BONUS } from "@/lib/pricing";

function errorText(msg: string) {
  if (/Invalid login credentials/i.test(msg)) return "이메일 또는 비밀번호가 맞지 않아요.";
  if (/Email not confirmed/i.test(msg)) return "이메일 인증이 아직 안 됐어요. 받은 메일함의 인증 링크를 눌러 주세요.";
  if (/already registered/i.test(msg)) return "이미 가입된 이메일이에요. 로그인해 주세요.";
  if (/Password should be at least/i.test(msg)) return "비밀번호는 6자 이상이어야 해요.";
  if (/rate limit/i.test(msg)) return "요청이 많아요. 잠시 후 다시 시도해 주세요.";
  return msg;
}

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [next, setNext] = useState("/create");

  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("mode") === "signup") setMode("signup");
    const n = q.get("next");
    if (n && n.startsWith("/")) setNext(n);
    if (q.get("error")) setError("인증 링크가 만료되었거나 올바르지 않아요. 다시 시도해 주세요.");
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setInfo("");
    const sb = supabaseBrowser();
    try {
      if (mode === "login") {
        const { error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw error;
        window.location.href = next;
      } else {
        const { data, error } = await sb.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        if (data.session) window.location.href = next;
        else setInfo("인증 메일을 보냈어요. 메일함에서 링크를 누르면 가입이 완료돼요.");
      }
    } catch (err) {
      setError(errorText((err as Error).message));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <TopBar right={<span />} />
      <main className="auth-wrap">
        <form className="auth-card stack" onSubmit={submit}>
          <div>
            <h1>{mode === "login" ? "다시 오셨네요" : "무료로 시작하기"}</h1>
            <p className="muted" style={{ margin: 0 }}>
              {mode === "login" ? "이메일로 로그인하세요." : `가입하면 ${SIGNUP_BONUS} 크레딧을 드려요. (상세페이지 약 2~3개)`}
            </p>
          </div>
          <div className="tabs" style={{ margin: 0 }}>
            <button type="button" className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>로그인</button>
            <button type="button" className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>회원가입</button>
          </div>
          <div className="field">
            <label>이메일</label>
            <input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          </div>
          <div className="field">
            <label>비밀번호</label>
            <input className="input" type="password" required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="6자 이상" />
          </div>
          {error && <div className="error-box">{error}</div>}
          {info && <div className="ok-box">{info}</div>}
          <button className="btn btn-primary btn-lg" disabled={busy}>
            {busy ? <span className="spinner" /> : mode === "login" ? "로그인" : "가입하고 크레딧 받기"}
          </button>
          {mode === "login" && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={async () => {
                if (!email) return setError("비밀번호를 재설정할 이메일을 먼저 입력해 주세요.");
                const { error } = await supabaseBrowser().auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/auth/callback?next=/account` });
                if (error) setError(errorText(error.message));
                else setInfo("비밀번호 재설정 메일을 보냈어요.");
              }}
            >
              비밀번호를 잊으셨나요?
            </button>
          )}
        </form>
      </main>
    </>
  );
}
