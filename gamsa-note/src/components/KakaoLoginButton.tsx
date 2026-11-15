"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function KakaoLoginButton({ next = "/calendar" }: { next?: string }) {
  const [busy, setBusy] = useState(false);
  const login = async () => {
    setBusy(true);
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : "/calendar";
    const { error } = await supabase().auth.signInWithOAuth({
      provider: "kakao",
      options: { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safe)}` },
    });
    if (error) { alert("카카오 로그인을 시작하지 못했어요."); setBusy(false); }
  };
  return (
    <button onClick={login} disabled={busy}
      className="w-full max-w-xs h-12 rounded-xl bg-[#FEE500] text-black/85 font-semibold flex items-center justify-center gap-2 border-[3px] border-ink shadow-[3px_3px_0_#3b2a1e] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_#3b2a1e] disabled:opacity-60">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden><path fill="#000" d="M12 3C6.48 3 2 6.58 2 11c0 2.86 1.88 5.37 4.7 6.78-.2.74-.75 2.7-.86 3.12-.13.52.19.51.4.37.17-.11 2.64-1.79 3.71-2.52.66.1 1.34.15 2.05.15 5.52 0 10-3.58 10-8S17.52 3 12 3z"/></svg>
      {busy ? "카카오로 이동 중…" : "카카오로 시작하기"}
    </button>
  );
}
