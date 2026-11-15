"use client";
import { GamTree, Persimmon } from "./Illust";
import { FULL_AT, stageOf } from "@/lib/growth";
import { fruitsOf } from "@/lib/illust";
import { koShort, today } from "@/lib/date";

export type FarmTreeData = {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  member_count: number;
  note_count: number;
  is_member: boolean;
};

export function seedOf(id: string) {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 1000;
}

export function periodState(t: { start_date: string; end_date: string }) {
  const td = today();
  if (td < t.start_date) {
    const d = Math.ceil((new Date(t.start_date).getTime() - new Date(td).getTime()) / 86400000);
    return { label: `D-${d} 시작`, tone: "bg-sky-100 text-sky-700" };
  }
  if (td > t.end_date) return { label: "수확 완료", tone: "bg-stone-100 text-stone-500" };
  const d = Math.ceil((new Date(t.end_date).getTime() - new Date(td).getTime()) / 86400000);
  return { label: d === 0 ? "오늘 마감" : `D-${d}`, tone: "bg-lime-100 text-lime-800" };
}

export function SignBoard({ name, small }: { name: string; small?: boolean }) {
  return (
    <span className={`wood-sign inline-block text-center leading-tight break-keep ${small ? "text-[12px] px-2.5 py-0.5 max-w-[10rem]" : "text-[14px] px-3 py-1 max-w-[14rem]"}`}>
      {name}
    </span>
  );
}

export default function FarmTree({ t, onClick }: { t: FarmTreeData; onClick?: () => void }) {
  const st = stageOf(t.note_count);
  const ps = periodState(t);
  const mine = t.is_member;
  return (
    <button onClick={onClick}
      className={`relative w-full text-left rounded-[20px] p-3 pb-3.5 transition-transform active:scale-[.98] ${mine ? "bg-gam text-white" : "bg-white"}`}>
      <div className="flex items-center justify-between text-[11px] font-semibold">
        <span className={`flex items-center gap-1 ${mine ? "" : "text-sub"}`}><Persimmon className="w-3.5 h-3.5" face={false} />{t.note_count}</span>
        <span className={`rounded-full px-1.5 py-0.5 ${mine ? "bg-white/25" : ps.tone}`}>{ps.label}</span>
      </div>
      <div className={`mt-2 mx-auto w-[82%] aspect-square rounded-full flex items-end justify-center overflow-hidden ${mine ? "bg-white" : "bg-peach"}`}>
        <GamTree count={t.note_count} className="w-[88%] -mb-0.5" />
      </div>
      <div className="mt-2.5 flex justify-center"><span className={`text-[13px] font-bold rounded-full px-2.5 py-0.5 text-center break-keep ${mine ? "bg-white text-ink" : "bg-cream"}`}>{t.name}</span></div>
      <p className={`mt-1.5 text-center text-[11px] ${mine ? "text-white/85" : "text-sub"}`}>{st.label}{mine ? " · 내 나무" : ""}</p>
    </button>
  );
}

export function TreeDetail({ t, onClose }: { t: FarmTreeData; onClose: () => void }) {
  const st = stageOf(t.note_count);
  const { grown, shown } = fruitsOf(t.note_count);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-8 sm:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="relative px-5 pt-5">
          <button onClick={onClose} className="absolute right-4 top-4 w-9 h-9 rounded-full bg-cream text-lg" aria-label="닫기">×</button>
          <div className="flex flex-col items-center">
            <SignBoard name={t.name} />
            <div className="mt-3 w-56 h-56 rounded-full bg-peach flex items-end justify-center overflow-hidden">
              <GamTree count={t.note_count} className="w-[88%]" />
            </div>
          </div>
        </div>
        <div className="px-5 pt-4">
          <dl className="grid grid-cols-2 gap-2.5 text-sm">
            {[
              ["키우는 기간", `${koShort(t.start_date)} ~ ${koShort(t.end_date)}`],
              ["함께하는 사람", `${t.member_count}명`],
              ["모인 감사", `${t.note_count}개`],
              ["성장 단계", st.label],
            ].map(([k, v]) => (
              <div key={k} className="bg-cream rounded-xl p-3"><dt className="text-[11px] text-sub">{k}</dt><dd className="font-bold text-[15px]">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4">
            {t.note_count <= FULL_AT ? (
              <>
                <p className="text-sm mb-1.5">풍성한 나무까지 <b>{FULL_AT - t.note_count}</b>개 남았어요. 101번째 감사부터 감이 열려요!</p>
                <div className="h-2 rounded-full bg-cream overflow-hidden"><div className="h-full rounded-full bg-gam" style={{ width: `${(t.note_count / FULL_AT) * 100}%` }} /></div>
              </>
            ) : (
              <p className="text-sm flex items-center gap-2 flex-wrap"><Persimmon className="w-7 h-7" /> 주황색 감이 <b>{grown}</b>개 열렸어요!
                {grown > shown && <span className="text-ink/50 text-xs">(나무에는 {shown}개까지 보여요)</span>}
              </p>
            )}
          </div>
          <p className="mt-3 text-xs text-ink/50">감은 키우는 기간 동안 참여자들이 쓴 감사노트 개수만큼 열려요. 내용은 공유되지 않아요.</p>
        </div>
      </div>
    </div>
  );
}
