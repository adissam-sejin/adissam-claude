"use client";
import { GamTree, Persimmon } from "./Art3D";
import { FULL_AT, fruitsOf, stageOf } from "@/lib/growth";
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
    <div className="relative flex flex-col items-center">
      <div className={`wood-sign text-center leading-tight break-keep ${small ? "text-[13px] px-2.5 py-1 max-w-[10rem]" : "text-base px-4 py-1.5 max-w-[14rem]"}`}>
        {name}
      </div>
      <div className="w-1.5 h-3 rounded-b bg-[#a8673a]" />
    </div>
  );
}

export default function FarmTree({ t, onClick }: { t: FarmTreeData; onClick?: () => void }) {
  const st = stageOf(t.note_count);
  const ps = periodState(t);
  return (
    <button onClick={onClick} className="relative flex flex-col items-center group focus:outline-none">
      {t.is_member && (
        <span className="absolute top-1 right-1 z-10 font-display text-[11px] btn-gam px-2 py-0.5 rounded-full shadow">내 나무</span>
      )}
      <GamTree count={t.note_count} seed={seedOf(t.id)} className="w-full max-w-[220px] group-hover:-translate-y-1 transition-transform duration-300" />
      <div className="-mt-3 relative z-10"><SignBoard name={t.name} small /></div>
      <div className="mt-1.5 flex items-center gap-1 text-[12px] bg-white/90 rounded-full shadow-sm px-2.5 py-0.5">
        <Persimmon small className="w-4 h-4" />
        <b>{t.note_count}</b>
        <span className="text-ink/30">·</span>
        <span>{st.label}</span>
      </div>
      <span className={`mt-1 text-[11px] font-display px-2 py-0.5 rounded-full ${ps.tone}`}>{ps.label}</span>
    </button>
  );
}

export function TreeDetail({ t, onClose }: { t: FarmTreeData; onClose: () => void }) {
  const st = stageOf(t.note_count);
  const { grown, shown } = fruitsOf(t.note_count);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden pb-8 sm:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="farm-sky relative px-5 pt-4">
          <button onClick={onClose} className="absolute right-4 top-4 w-9 h-9 rounded-full bg-white/90 shadow text-lg" aria-label="닫기">×</button>
          <div className="flex flex-col items-center">
            <SignBoard name={t.name} />
            <GamTree count={t.note_count} seed={seedOf(t.id)} className="w-64 -mt-2" />
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
              <div key={k} className="bg-white rounded-2xl p-3 shadow-sm"><dt className="text-[11px] text-ink/50">{k}</dt><dd className="font-display text-base">{v}</dd></div>
            ))}
          </dl>
          <div className="mt-4">
            {t.note_count <= FULL_AT ? (
              <>
                <p className="text-sm mb-1.5">풍성한 나무까지 <b>{FULL_AT - t.note_count}</b>개 남았어요. 101번째 감사부터 감이 열려요!</p>
                <div className="h-3.5 rounded-full bg-white shadow-inner overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-lime-400 to-green-600" style={{ width: `${(t.note_count / FULL_AT) * 100}%` }} /></div>
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
