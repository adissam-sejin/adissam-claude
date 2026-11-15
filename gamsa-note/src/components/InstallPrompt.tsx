"use client";
import { useEffect, useState } from "react";
import { Persimmon } from "./Illust";

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };
type Mode = "android" | "ios" | "kakao" | null;

const KEY = "gamsa-install-dismissed";

function store(get: true): string | null;
function store(get: false, v: string): void;
function store(get: boolean, v?: string) {
  try {
    if (get) return localStorage.getItem(KEY);
    localStorage.setItem(KEY, v!);
  } catch { /* 저장소 사용 불가 */ }
  return null;
}

/** 처음 들어오면 홈 화면 설치 안내를 띄움 */
export default function InstallPrompt() {
  const [mode, setMode] = useState<Mode>(null);
  const [evt, setEvt] = useState<BIPEvent | null>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});

    const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
    if (standalone) return;
    const dismissed = store(true);
    if (dismissed && Date.now() - Number(dismissed) < 1000 * 60 * 60 * 24 * 3) return; // 닫으면 3일 동안 안 보임

    const ua = navigator.userAgent;
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua);
    if (/KAKAOTALK/i.test(ua)) { setMode("kakao"); return; }
    if (/iPhone|iPad|iPod/i.test(ua)) { setMode("ios"); return; }

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setEvt(e as BIPEvent);
      if (isMobile) setMode("android");
    };
    const onInstalled = () => { setMode(null); store(false, String(Date.now() + 1e12)); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (!mode) return null;

  const close = () => { store(false, String(Date.now())); setMode(null); };
  const install = async () => {
    if (!evt) return;
    await evt.prompt();
    const r = await evt.userChoice;
    if (r.outcome === "accepted") setMode(null);
    setEvt(null);
  };
  const openExternal = () => {
    const url = window.location.href;
    if (/Android/i.test(navigator.userAgent)) {
      window.location.href = `intent://${url.replace(/^https?:\/\//, "")}#Intent;scheme=https;package=com.android.chrome;end`;
    } else {
      window.location.href = `kakaotalk://web/openExternal?url=${encodeURIComponent(url)}`;
    }
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-end justify-center" onClick={close}>
      <div className="w-full max-w-md bg-white rounded-t-[24px] px-6 pt-6 pb-8" style={{ paddingBottom: "calc(2rem + var(--safe-bottom))" }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/icons/icon-192.png" alt="" className="w-14 h-14 rounded-2xl" />
          <div>
            <p className="text-[17px] font-extrabold">감사노트를 앱으로 설치할까요?</p>
            <p className="text-[13px] text-sub mt-0.5">홈 화면에서 바로 열고, 매일 감사를 기록해요.</p>
          </div>
        </div>

        {mode === "android" && (
          <button onClick={install} className="btn3d btn-gam w-full mt-6 py-3.5 text-[15px]">홈 화면에 설치하기</button>
        )}

        {mode === "ios" && (
          <ol className="mt-5 space-y-3 text-[14px]">
            <li className="flex items-center gap-3 bg-cream rounded-xl px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-gam text-white text-[12px] font-bold flex items-center justify-center shrink-0">1</span>
              <span>Safari 아래쪽 <b>공유 버튼</b>
                <svg className="inline w-5 h-5 mx-1 -mt-1 text-[#0a84ff]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3v12" /><path d="m8 7 4-4 4 4" /><path d="M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" /></svg>
                을 눌러요</span>
            </li>
            <li className="flex items-center gap-3 bg-cream rounded-xl px-4 py-3">
              <span className="w-6 h-6 rounded-full bg-gam text-white text-[12px] font-bold flex items-center justify-center shrink-0">2</span>
              <span><b>홈 화면에 추가</b>를 누르면 끝!</span>
            </li>
          </ol>
        )}

        {mode === "kakao" && (
          <>
            <p className="mt-5 text-[14px] bg-cream rounded-xl px-4 py-3 leading-relaxed">
              카카오톡 안에서는 앱 설치가 안 돼요.<br />
              <b>{/iPhone|iPad|iPod/i.test(typeof navigator !== "undefined" ? navigator.userAgent : "") ? "Safari" : "Chrome"}</b>로 열어서 설치해 주세요.
            </p>
            <button onClick={openExternal} className="btn3d btn-gam w-full mt-4 py-3.5 text-[15px]">다른 브라우저로 열기</button>
          </>
        )}

        <button onClick={close} className="w-full mt-3 py-2 text-[13px] text-sub flex items-center justify-center gap-1">
          <Persimmon className="w-4 h-4" face={false} /> 다음에 할게요
        </button>
      </div>
    </div>
  );
}
