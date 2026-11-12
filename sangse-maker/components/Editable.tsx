"use client";

import { useEffect, useRef, type ElementType } from "react";

/** 클릭해서 바로 고치는 텍스트. 편집 모드가 아니면 그냥 텍스트로 렌더링 */
export function Editable({
  value,
  onChange,
  editable,
  as: Tag = "div",
  className,
  placeholder,
}: {
  value: string;
  onChange?: (v: string) => void;
  editable?: boolean;
  as?: ElementType;
  className?: string;
  placeholder?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  // 외부에서 값이 바뀌면(되돌리기, AI 수정) 화면에 반영. 입력 중일 땐 건드리지 않음
  useEffect(() => {
    const el = ref.current;
    if (el && document.activeElement !== el && el.innerText !== value) el.innerText = value;
  }, [value]);

  if (!editable) {
    if (!value) return null;
    return <Tag className={className}>{value}</Tag>;
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
        if (v !== value) onChange?.(v);
      }}
      onPaste={(e: React.ClipboardEvent<HTMLElement>) => {
        // 서식 없이 텍스트만 붙여넣기
        e.preventDefault();
        document.execCommand("insertText", false, e.clipboardData.getData("text/plain"));
      }}
    >
      {value}
    </Tag>
  );
}
