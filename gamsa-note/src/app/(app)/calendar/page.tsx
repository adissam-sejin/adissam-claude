"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { GamTree, Persimmon } from "@/components/Art3D";
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
  const [toast, setToast] = useState(params.get("saved") ? "감사가 심어졌어요! 🧡" : "");
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
      <section className="relative isolate -mx-4 px-4 text-center pt-1 pb-2 text-white">
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 top-[262px] w-[240%] sm:w-[160%] h-[3000px] rounded-[50%] bg-gradient-to-b from-[#b4de86] via-[#9dd06f] to-[#8fc664] -z-10" />
        <p className="text-sm font-semibold drop-shadow-[0_1px_4px_rgba(30,90,150,.4)]">{profile?.nickname ?? ""}님의 {thisYear}년 감사</p>
        <div className="flex items-end justify-center gap-2 -mt-1 drop-shadow-[0_4px_14px_rgba(30,90,150,.35)]">
          <span className="thin-num text-[88px] leading-none">{yearCount ?? 0}</span>
          <span className="text-xl font-semibold pb-3">/ {total}일</span>
        </div>
        <p className="text-[13px] font-medium opacity-95 drop-shadow-[0_1px_4px_rgba(30,90,150,.4)]">올해 총 {total}일 중 {yearCount ?? 0}일 감사노트를 작성했어요</p>
        <div className="relative mx-auto w-56 sm:w-64 -mt-1">
          <GamTree count={yearCount ?? 0} className="w-full floaty drop-shadow-[0_18px_18px_rgba(40,90,40,.25)]" />
        </div>
        <p className="font-display text-[28px] text-white drop-shadow-[0_2px_8px_rgba(40,90,40,.35)] -mt-1">Lv.{lv.level} <span className="text-lg">{lv.label}</span></p>
        <div className="max-w-xs mx-auto mt-2 text-left">
          <div className="flex justify-between text-[11px] font-semibold text-white mb-1 drop-shadow">
            <span>나의 감나무 경험치</span>
            <span>{lv.cur}/{lv.max}</span>
          </div>
          <div className="xp"><div style={{ width: `${(lv.cur / lv.max) * 100}%` }} /></div>
          <p className="text-[11px] text-white/95 mt-1 text-right drop-shadow">{lv.grown ? `감 ${lv.grown}개가 열렸어요 · ` : ""}{lv.next}</p>
        </div>
      </section>

      {wroteToday === false && (
        <Link href="/write" className="btn3d btn-white mt-4 flex items-center justify-between px-6 py-4 text-[17px]">
          <span>오늘의 감사 심기</span>
          <span className="flex items-center gap-1 text-gam-dark"><Persimmon small className="w-6 h-6" />+1</span>
        </Link>
      )}

      <div className="mt-5 card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => move(-1)} className="btn3d w-9 h-9 btn-white text-lg" aria-label="이전 달">‹</button>
        <div className="text-center">
          <h1 className="font-display text-xl font-bold">{ym.y}. {pad(ym.m + 1)}</h1>
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
                  ${isToday ? "border-white bg-white/70 shadow-sm" : "border-transparent hover:bg-white/40"}
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
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 card px-4 py-2 font-display text-sm">{toast}</div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return <Suspense><CalendarInner /></Suspense>;
}
