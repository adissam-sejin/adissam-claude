"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GamTree, Persimmon } from "@/components/Illust";
import { levelInfo } from "@/lib/growth";
import NoteModal, { type ViewNote } from "@/components/NoteModal";
import { useAuth } from "@/components/AuthProvider";
import { supabase, signedUrls } from "@/lib/supabase";
import { daysInYear, pad, today, ymd } from "@/lib/date";

const WEEK = ["일", "월", "화", "수", "목", "금", "토"];

function CalendarInner() {
  const { user, profile } = useAuth();
  const router = useRouter();
  const params = useSearchParams();
  const now = new Date();
  const [ym, setYm] = useState({ y: now.getFullYear(), m: now.getMonth() });
  const [notes, setNotes] = useState<Record<string, ViewNote>>({});
  const [yearCount, setYearCount] = useState<number | null>(null);
  const [open, setOpen] = useState<ViewNote | null>(null);
  const [toast, setToast] = useState(params.get("saved") ? "오늘의 감사가 기록되었어요!" : "");
  const thisYear = now.getFullYear();
  const todayStr = today();

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 2500);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!user) return;
    supabase().from("notes").select("id", { count: "exact", head: true })
      .eq("user_id", user.id).gte("note_date", `${thisYear}-01-01`).lte("note_date", `${thisYear}-12-31`)
      .then(({ count }) => setYearCount(count ?? 0));
  }, [user, thisYear]);

  useEffect(() => {
    if (!user) return;
    const from = ymd(new Date(ym.y, ym.m, 1));
    const to = ymd(new Date(ym.y, ym.m + 1, 0));
    supabase().from("notes").select("id,note_date,content,photo_path,is_public")
      .eq("user_id", user.id).gte("note_date", from).lte("note_date", to)
      .then(({ data }) => {
        const map: Record<string, ViewNote> = {};
        (data ?? []).forEach((n) => (map[n.note_date] = n));
        setNotes(map);
      });
  }, [user, ym]);

  const cells = useMemo(() => {
    const first = new Date(ym.y, ym.m, 1).getDay();
    const days = new Date(ym.y, ym.m + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  }, [ym]);

  const move = (d: number) => setYm(({ y, m }) => {
    const t = new Date(y, m + d, 1);
    return { y: t.getFullYear(), m: t.getMonth() };
  });

  const openDay = async (day: number) => {
    const key = `${ym.y}-${pad(ym.m + 1)}-${pad(day)}`;
    const n = notes[key];
    if (n) {
      const urls = await signedUrls([n.photo_path]);
      setOpen({ ...n, photoUrl: n.photo_path ? urls[n.photo_path] : null });
    } else if (key <= todayStr) {
      router.push(`/write?date=${key}`);
    }
  };

  const total = daysInYear(thisYear);
  const monthCount = Object.keys(notes).length;
  const wroteToday = ym.y === now.getFullYear() && ym.m === now.getMonth() ? todayStr in notes : null;

  const lv = levelInfo(yearCount ?? 0);

  return (
    <div className="max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-[20px] font-extrabold">MY 감나무</h1>
        <Link href="/farm" className="text-[12px] font-semibold text-gam bg-gam-light rounded-full px-2.5 py-1">감농장</Link>
      </div>

      <section className="text-center">
        <GamTree count={yearCount ?? 0} className="w-full max-w-[340px] mx-auto -mt-2" />
        <div className="-mt-1 flex justify-center items-center gap-2">
          <span className="bg-gam text-white text-[14px] font-bold rounded-full px-3.5 py-1">Lv.{lv.level} {lv.label}</span>
          {lv.grown > 0 && <span className="bg-white border border-line text-[13px] font-bold rounded-full px-3 py-1 flex items-center gap-1"><Persimmon className="w-4 h-4" face={false} />감 {lv.grown}개</span>}
        </div>
        <div className="mt-4 max-w-xs mx-auto h-2.5 rounded-full bg-gam-light overflow-hidden"><div className="h-full rounded-full bg-gam" style={{ width: `${(lv.cur / lv.max) * 100}%` }} /></div>
        <p className="mt-1.5 text-[12px] text-sub">{lv.next}</p>
        <p className="mt-3 text-[15px] font-semibold leading-snug">
          올해 총 {total}일 중 <b className="text-gam text-[18px]">{yearCount ?? 0}일</b> 감사노트를 작성했어요
        </p>
      </section>

      {wroteToday === false && (
        <Link href="/write" className="btn3d btn-soft mt-5 flex items-center justify-center gap-2 py-3.5 text-[15px]">
          <Persimmon className="w-5 h-5" /> 오늘의 감사 쓰러 가기
        </Link>
      )}

      <div className="mt-5 card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => move(-1)} className="btn3d w-9 h-9 btn-white text-lg" aria-label="이전 달">‹</button>
        <div className="text-center">
          <h2 className="text-lg font-extrabold">{ym.y}. {pad(ym.m + 1)}</h2>
          <p className="text-xs text-ink/60">이번 달 감 {monthCount}개</p>
        </div>
        <button onClick={() => move(1)} className="btn3d w-9 h-9 btn-white text-lg" aria-label="다음 달">›</button>
      </div>

      <div>
        <div className="grid grid-cols-7 mb-1">
          {WEEK.map((w, i) => (
            <div key={w} className={`font-display text-center text-xs py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-ink/60"}`}>{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const key = `${ym.y}-${pad(ym.m + 1)}-${pad(d)}`;
            const has = !!notes[key];
            const isToday = key === todayStr;
            const future = key > todayStr;
            return (
              <button key={i} onClick={() => openDay(d)} disabled={future && !has}
                className={`relative aspect-square rounded-xl flex flex-col items-center justify-start pt-1 border-2
                  ${isToday ? "border-gam bg-peach" : "border-transparent hover:bg-cream"}
                  ${future ? "opacity-35" : ""}`}>
                <span className={`font-display text-[11px] sm:text-xs leading-none ${i % 7 === 0 ? "text-red-500" : i % 7 === 6 ? "text-blue-500" : ""}`}>{d}</span>
                {has && <Persimmon small className="w-[70%] h-[70%] drop-shadow-[0_2px_2px_rgba(0,0,0,.2)]" title="감사 기록" />}
              </button>
            );
          })}
        </div>
      </div>
      </div>

      {open && <NoteModal note={open} onClose={() => setOpen(null)} />}
      {toast && (
        <div className="fixed left-4 right-4 top-16 z-50 mx-auto max-w-md rounded-xl bg-[#34c26a] text-white px-4 py-3 text-sm font-semibold shadow-lg animate-[slidein_.25s_ease-out]">{toast}</div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return <Suspense><CalendarInner /></Suspense>;
}
