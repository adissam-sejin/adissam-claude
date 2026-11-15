"use client";
import { PixelTree, Persimmon } from "./Pixel";
import { FULL_AT, stageOf, treeGrid } from "@/lib/pixel";
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
  return h;
}

export function periodState(t: { start_date: string; end_date: string }) {
  const td = today();
  if (td < t.start_date) {
    const d = Math.ceil((new Date(t.start_date).getTime() - new Date(td).getTime()) / 86400000);
    return { label: `D-${d} 시작`, tone: "bg-sky-200" };
  }
  if (td > t.end_date) return { label: "수확 완료", tone: "bg-ink/15" };
  const d = Math.ceil((new Date(t.end_date).getTime() - new Date(td).getTime()) / 86400000);
  return { label: d === 0 ? "오늘 마감" : `D-${d}`, tone: "bg-lime-200" };
}

export function SignBoard({ name, small }: { name: string; small?: boolean }) {
  return (
    <div className="relative flex flex-col items-center">
      <div className={`pixel font-bold text-ink bg-[#e8b77c] border-[3px] border-[#6b4226] shadow-[inset_-3px_-3px_0_#c98f52,inset_3px_3px_0_#f6d3a2] text-center leading-tight break-keep
        ${small ? "text-[11px] px-2 py-1 max-w-[9rem]" : "text-sm px-3 py-1.5 max-w-[12rem]"}`}>
        {name}
      </div>
      <div className="w-[6px] h-3 bg-[#6b4226]" />
    </div>
  );
}

export default function FarmTree({ t, onClick }: { t: FarmTreeData; onClick?: () => void }) {
  const st = stageOf(t.note_count);
  const ps = periodState(t);
  return (
    <button onClick={onClick} className="relative flex flex-col items-center group focus:outline-none">
      {t.is_member && (
        <span className="absolute -top-1 right-1 z-10 pixel text-[10px] bg-gam text-white px-1.5 py-0.5 border-2 border-ink">내 나무</span>
      )}
      <PixelTree count={t.note_count} seed={seedOf(t.id)} className="w-full max-w-[180px] aspect-[40/44] group-hover:-translate-y-0.5 transition-transform" />
      <div className="-mt-1"><SignBoard name={t.name} small /></div>
      <div className="mt-1 flex items-center gap-1 pixel text-[11px] bg-white/85 border-2 border-ink px-1.5 py-0.5">
        <Persimmon className="w-3.5 h-3.5" />
        <span>{t.note_count}</span>
        <span className="text-ink/40">·</span>
        <span>{st.label}</span>
      </div>
      <span className={`mt-1 pixel text-[10px] px-1.5 ${ps.tone} border border-ink/40`}>{ps.label}</span>
    </button>
  );
}

export function TreeDetail({ t, onClose }: { t: FarmTreeData; onClose: () => void }) {
  const st = stageOf(t.note_count);
  const { fruits } = treeGrid(t.note_count, seedOf(t.id));
  const grown = t.note_count > FULL_AT ? t.note_count - FULL_AT : 0;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" onClick={onClose}>
      <div className="bg-cream w-full sm:max-w-md border-t-[3px] sm:border-[3px] border-ink sm:shadow-[6px_6px_0_#3b2a1e] p-5 pb-8 sm:pb-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex justify-end"><button onClick={onClose} className="w-9 h-9 border-2 border-ink bg-white rounded" aria-label="닫기">×</button></div>
        <div className="farm-sky -mx-5 px-5 pt-4">
          <div className="flex flex-col items-center">
            <SignBoard name={t.name} />
            <PixelTree count={t.note_count} seed={seedOf(t.id)} className="w-56 aspect-[40/44] -mt-1" />
          </div>
        </div>
        <div className="farm-ground h-3 -mx-5 mb-4" />
        <dl className="grid grid-cols-2 gap-2 text-sm">
          <div className="px-box p-2"><dt className="pixel text-[11px] text-ink/60">키우는 기간</dt><dd className="font-bold">{koShort(t.start_date)} ~ {koShort(t.end_date)}</dd></div>
          <div className="px-box p-2"><dt className="pixel text-[11px] text-ink/60">함께하는 사람</dt><dd className="font-bold">{t.member_count}명</dd></div>
          <div className="px-box p-2"><dt className="pixel text-[11px] text-ink/60">모인 감사</dt><dd className="font-bold">{t.note_count}개</dd></div>
          <div className="px-box p-2"><dt className="pixel text-[11px] text-ink/60">성장 단계</dt><dd className="font-bold">{st.label}</dd></div>
        </dl>
        <div className="mt-4">
          {t.note_count <= FULL_AT ? (
            <>
              <p className="text-sm mb-1">풍성한 나무까지 <b>{FULL_AT - t.note_count}</b>개 남았어요. 101번째 감사부터 감이 열려요!</p>
              <div className="h-4 border-2 border-ink bg-white"><div className="h-full bg-leaf" style={{ width: `${(t.note_count / FULL_AT) * 100}%` }} /></div>
            </>
          ) : (
            <p className="text-sm flex items-center gap-2"><Persimmon className="w-6 h-6" /> 주황색 감이 <b>{grown}</b>개 열렸어요!
              {grown > fruits && <span className="text-ink/50 text-xs">(나무에는 {fruits}개까지 보여요)</span>}
            </p>
          )}
        </div>
        <p className="mt-3 text-xs text-ink/50">감은 키우는 기간 동안 참여자들이 쓴 감사노트 개수만큼 열려요. 내용은 공유되지 않아요.</p>
      </div>
    </div>
  );
}
