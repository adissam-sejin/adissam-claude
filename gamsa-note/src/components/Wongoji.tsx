"use client";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { wongojiLayout as layout } from "@/lib/wongoji";

function useCols() {
  const [cols, setCols] = useState(15);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const f = () => setCols(mq.matches ? 20 : 15);
    f();
    mq.addEventListener("change", f);
    return () => mq.removeEventListener("change", f);
  }, []);
  return cols;
}

type Props = {
  value: string;
  onChange?: (v: string) => void;
  maxLength?: number;
  minRows?: number;
  readOnly?: boolean;
  placeholder?: string;
};

export default function Wongoji({ value, onChange, maxLength = 600, minRows = 8, readOnly, placeholder }: Props) {
  const cols = useCols();
  const ta = useRef<HTMLTextAreaElement>(null);
  const [caret, setCaret] = useState<number | null>(null);
  const chars = useMemo(() => Array.from(value), [value]);
  const { pos, cells, end } = useMemo(() => layout(value, cols), [value, cols]);

  const rows = Math.max(minRows, Math.ceil((end + 1) / cols));
  const total = rows * cols;

  // textarea selection(UTF-16) → 글자 index
  const syncCaret = useCallback(() => {
    const el = ta.current;
    if (!el || document.activeElement !== el) { setCaret(null); return; }
    const u16 = el.selectionStart ?? 0;
    setCaret(Array.from(el.value.slice(0, u16)).length);
  }, []);

  useLayoutEffect(() => { syncCaret(); }, [value, syncCaret]);

  const focusAt = (cellIdx: number) => {
    if (readOnly || !ta.current) return;
    let i = pos.findIndex((p, k) => k < chars.length ? p >= cellIdx : true);
    if (i < 0) i = chars.length;
    // 줄바꿈 뒤 빈칸을 누른 경우 → 그 줄바꿈 위치
    if (i > 0 && i <= chars.length && pos[i] > cellIdx && chars[i - 1] === "\n" && pos[i - 1] < cellIdx) i = i - 1;
    const u16 = chars.slice(0, i).join("").length;
    ta.current.focus({ preventScroll: true });
    ta.current.setSelectionRange(u16, u16);
    syncCaret();
  };

  const caretCell = caret == null ? -1 : pos[Math.min(caret, pos.length - 1)];

  return (
    <div className="relative">
      <div
        className="wongoji cursor-text"
        onMouseDown={(e) => { if (!readOnly) e.preventDefault(); }}
        onClick={(e) => {
          const t = (e.target as HTMLElement).closest("[data-i]") as HTMLElement | null;
          focusAt(t ? Number(t.dataset.i) : end);
        }}
      >
        {Array.from({ length: total }, (_, i) => (
          <div key={i} data-i={i} className={`cell ${i === caretCell ? "caret" : ""}`}>
            {cells[i] ?? ""}
          </div>
        ))}
      </div>
      {!value && placeholder && caret == null && (
        <div className="pointer-events-none absolute left-3 top-4 text-ink/35 text-sm pr-4">{placeholder}</div>
      )}
      {!readOnly && (
        <textarea
          ref={ta}
          value={value}
          maxLength={maxLength}
          onChange={(e) => onChange?.(e.target.value)}
          onSelect={syncCaret}
          onKeyUp={syncCaret}
          onFocus={syncCaret}
          onBlur={() => setCaret(null)}
          aria-label="감사 내용"
          className="absolute inset-0 w-full h-full opacity-0 pointer-events-none resize-none"
          style={{ fontSize: 16 }}
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
      )}
      {!readOnly && (
        <div className="mt-1 text-right text-xs text-ink/50 pixel">{chars.length} / {maxLength}자</div>
      )}
    </div>
  );
}
