"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Persimmon } from "@/components/Pixel";
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

  return (
    <div className="max-w-2xl mx-auto">
      <section className="px-box p-4 mb-5 bg-gam-light">
        <p className="text-sm text-ink/70">{profile?.nickname ?? ""}님의 {thisYear}년</p>
        <p className="mt-1 text-lg sm:text-xl font-bold leading-snug">
          올해 총 <span className="pixel">{total}</span>일 중{" "}
          <span className="pixel text-3xl text-gam-dark align-middle">{yearCount ?? "–"}</span>일
          <br className="sm:hidden" /> 감사노트를 작성했어요
        </p>
        <div className="mt-3 h-4 border-2 border-ink bg-white relative overflow-hidden">
          <div className="h-full bg-gam" style={{ width: `${Math.min(100, ((yearCount ?? 0) / total) * 100)}%` }} />
        </div>
        <p className="pixel text-[11px] text-right mt-1 text-ink/60">{(((yearCount ?? 0) / total) * 100).toFixed(1)}%</p>
      </section>

      <div className="flex items-center justify-between mb-3">
        <button onClick={() => move(-1)} className="px-btn w-10 h-10 bg-white" aria-label="이전 달">‹</button>
        <div className="text-center">
          <h1 className="pixel text-xl font-bold">{ym.y}. {pad(ym.m + 1)}</h1>
          <p className="text-xs text-ink/60">이번 달 감 {monthCount}개</p>
        </div>
        <button onClick={() => move(1)} className="px-btn w-10 h-10 bg-white" aria-label="다음 달">›</button>
      </div>

      <div className="px-box p-2 sm:p-3">
        <div className="grid grid-cols-7 mb-1">
          {WEEK.map((w, i) => (
            <div key={w} className={`pixel text-center text-xs py-1 ${i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-ink/60"}`}>{w}</div>
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
                className={`relative aspect-square rounded flex flex-col items-center justify-start pt-1 border-2
                  ${isToday ? "border-gam-dark bg-gam-light/40" : "border-transparent hover:border-ink/20"}
                  ${future ? "opacity-35" : ""}`}>
                <span className={`pixel text-[11px] sm:text-xs leading-none ${i % 7 === 0 ? "text-red-500" : i % 7 === 6 ? "text-blue-500" : ""}`}>{d}</span>
                {has && <Persimmon className="w-[62%] h-[62%] mt-0.5" title="감사 기록" />}
              </button>
            );
          })}
        </div>
      </div>

      {wroteToday === false && (
        <Link href="/write" className="px-btn mt-5 flex items-center justify-center gap-2 py-3 bg-gam text-white">
          <Persimmon className="w-5 h-5" /> 오늘의 감사 심으러 가기
        </Link>
      )}

      {open && <NoteModal note={open} onClose={() => setOpen(null)} />}
      {toast && (
        <div className="fixed left-1/2 -translate-x-1/2 bottom-24 md:bottom-8 z-50 px-box px-4 py-2 pixel text-sm">{toast}</div>
      )}
    </div>
  );
}

export default function CalendarPage() {
  return <Suspense><CalendarInner /></Suspense>;
}
