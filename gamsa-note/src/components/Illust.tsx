import { persimmonSvg, treeSvg } from "@/lib/illust";
import { stageOf } from "@/lib/growth";

export function Persimmon({ className = "w-6 h-6", title, face = true }: { className?: string; title?: string; small?: boolean; face?: boolean }) {
  return (
    <span role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}
      className={`inline-block shrink-0 [&>svg]:w-full [&>svg]:h-full ${className}`}
      dangerouslySetInnerHTML={{ __html: persimmonSvg({ face }) }} />
  );
}

/** 감사 개수에 따라 자라는 감나무. 101개부터 감이 열림 */
export function GamTree({ count, className = "" }: { count: number; className?: string; seed?: number }) {
  const st = stageOf(count);
  return (
    <span role="img" aria-label={`${st.label} (감사 ${count}개)`}
      className={`block aspect-[10/11] [&>svg]:w-full [&>svg]:h-full ${className}`}
      dangerouslySetInnerHTML={{ __html: treeSvg(count) }} />
  );
}
