/* eslint-disable @next/next/no-img-element */
import { FRUIT_SPOTS, fruitsOf, stageOf } from "@/lib/growth";

export function Persimmon({ className = "w-6 h-6", title, small }: { className?: string; title?: string; small?: boolean }) {
  return (
    <img src={small ? "/3d/persimmon-sm.webp" : "/3d/persimmon.webp"} alt={title ?? ""} aria-hidden={title ? undefined : true}
      className={`object-contain select-none ${className}`} draggable={false} />
  );
}

/** 감사 개수에 따라 자라는 3D 감나무. 101개부터 감이 열림 */
export function GamTree({ count, className = "", seed = 0 }: { count: number; className?: string; seed?: number }) {
  const st = stageOf(count);
  const { shown } = fruitsOf(count);
  // 감나무마다 열리는 순서를 조금씩 다르게
  const order = FRUIT_SPOTS.map((s, i) => ({ s, k: Math.sin(i * 12.9898 + seed * 78.233) })).sort((a, b) => a.k - b.k).map((o) => o.s);
  return (
    <div className={`relative aspect-[10/11] ${className}`}>
      <img src={`/3d/tree-${st.image}.webp`} alt={`${st.label} (감사 ${count}개)`} className="absolute inset-0 w-full h-full object-contain select-none" draggable={false} />
      {order.slice(0, shown).map((s, i) => (
        <img key={i} src="/3d/persimmon-sm.webp" alt="" aria-hidden
          className="absolute w-[8.5%] -translate-x-1/2 -translate-y-1/2 drop-shadow-[0_2px_2px_rgba(0,0,0,0.25)] animate-[pop_.4s_ease-out_both]"
          style={{ left: `${s.x * 100}%`, top: `${s.y * 100}%`, animationDelay: `${Math.min(i, 30) * 25}ms`, rotate: `${((i * 37) % 30) - 15}deg` }} />
      ))}
    </div>
  );
}
