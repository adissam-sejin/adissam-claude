"use client";

import { useEffect, useRef, useState, type ElementType, type ReactNode } from "react";

/** "**강조**" 표기를 하이라이트 박스로 바꿔 렌더링 */
export function renderRich(text: string): ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith("**") && p.endsWith("**") && p.length > 4 ? (
      <mark key={i} className="dp-hl">
        {p.slice(2, -2)}
      </mark>
    ) : (
      p
    ),
  );
}

/**
 * 클릭해서 바로 고치는 텍스트. 편집 모드가 아니면 그냥 텍스트로 렌더링.
 * rich: "**단어**" 를 강조 박스로 보여주고, 클릭하면 원문(** 포함)을 편집.
 */
export function Editable({
  value,
  onChange,
  editable,
  as: Tag = "div",
  className,
  placeholder,
  rich,
}: {
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  as?: ElementType;
  className?: string;
  placeholder?: string;
  rich?: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  const [editing, setEditing] = useState(false);
  const showRich = rich && !editing;

  // 외부에서 값이 바뀌면(되돌리기, AI 수정) 화면에 반영. 입력 중일 땐 건드리지 않음
  useEffect(() => {
    const el = ref.current;
    if (el && !showRich && document.activeElement !== el && el.innerText !== value) el.innerText = value;
  }, [value, showRich]);

  useEffect(() => {
    if (editing && ref.current) {
      ref.current.innerText = value;
      ref.current.focus();
      const range = document.createRange();
      range.selectNodeContents(ref.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);

  if (!editable) {
    if (!value) return null;
    return <Tag className={className}>{rich ? renderRich(value) : value}</Tag>;
  }

  if (showRich) {
    return (
      <Tag className={`${className ?? ""} editable`} data-placeholder={placeholder ?? "내용 입력"} onClick={() => setEditing(true)} title="클릭해서 수정 · **단어** 로 감싸면 강조돼요">
        {value ? renderRich(value) : null}
      </Tag>
    );
  }

  return (
    <Tag
      ref={ref}
      className={`${className ?? ""} editable`}
      contentEditable
      suppressContentEditableWarning
      data-placeholder={placeholder ?? "내용 입력"}
      onBlur={(e: React.FocusEvent<HTMLElement>) => {
        const v = e.currentTarget.innerText.replace(/\n$/, "");
        setEditing(false);
        if (v !== value) onChange?.(v);
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        // 서식 없이 텍스트만 붙여넣기
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    >
      {rich ? null : value}
    </Tag>
  );
}
