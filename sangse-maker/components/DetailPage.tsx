"use client";

import { forwardRef, type CSSProperties } from "react";
import type { Item, Page, Section } from "@/lib/schema";
import { Editable } from "./Editable";

interface Props {
  page: Page;
  images: string[];
  editable?: boolean;
  selected?: number | null;
  onSelect?: (i: number) => void;
  onSectionChange?: (i: number, s: Section) => void;
}

/** 860px 기준으로 상세페이지를 그린다. 내보낼 때 채널 폭 비율로 스케일. */
export const DetailPage = forwardRef<HTMLDivElement, Props>(function DetailPage(
  { page, images, editable, selected, onSelect, onSectionChange },
  ref,
) {
  const { theme } = page;
  const style = {
    "--p": theme.primary,
    "--a": theme.accent,
    "--bg": theme.background,
  } as CSSProperties;

  return (
    <div ref={ref} className={`dp style-${theme.style}`} style={style}>
      {page.sections.map((s, i) => (
        <section
          key={i}
          data-export-section
          className={`dp-sec dp-${s.type} ${editable && selected === i ? "is-selected" : ""}`}
          onClick={() => onSelect?.(i)}
        >
          <SectionView
            s={s}
            images={images}
            editable={editable}
            set={(patch) => onSectionChange?.(i, { ...s, ...patch })}
          />
        </section>
      ))}
    </div>
  );
});

type Setter = (patch: Partial<Section>) => void;

function SectionView({ s, images, editable, set }: { s: Section; images: string[]; editable?: boolean; set: Setter }) {
  const img = (n: number) => (n >= 0 && images[n] ? images[n] : null);
  const E = (field: "eyebrow" | "title" | "body", cls: string, placeholder?: string) => (
    <Editable value={s[field]} editable={editable} onChange={(v) => set({ [field]: v })} className={cls} placeholder={placeholder} />
  );
  const setItem = (idx: number, patch: Partial<Item>) =>
    set({ items: s.items.map((it, j) => (j === idx ? { ...it, ...patch } : it)) });
  const IE = (idx: number, field: "title" | "desc" | "extra", cls: string) => (
    <Editable value={s.items[idx][field]} editable={editable} onChange={(v) => setItem(idx, { [field]: v })} className={cls} />
  );
  const head = (
    <header className="dp-head">
      {E("eyebrow", "dp-eyebrow", "라벨")}
      {E("title", "dp-title", "제목")}
      {E("body", "dp-body", "설명")}
    </header>
  );
  const mainImg = img(s.imageIndex);

  switch (s.type) {
    case "hero":
      return (
        <>
          <div className="dp-hero-text">
            {E("eyebrow", "dp-eyebrow", "라벨")}
            {E("title", "dp-hero-title", "헤드라인")}
            {E("body", "dp-hero-sub", "서브 카피")}
          </div>
          {mainImg && <img className="dp-hero-img" src={mainImg} alt="" />}
        </>
      );

    case "problem":
      return (
        <>
          {head}
          <div className="dp-bubbles">
            {s.items.map((_, i) => (
              <div key={i} className={`dp-bubble ${i % 2 ? "right" : ""}`}>
                {IE(i, "title", "")}
              </div>
            ))}
          </div>
        </>
      );

    case "features":
      return (
        <>
          {head}
          <div className="dp-features">
            {s.items.map((it, i) => (
              <div key={i} className={`dp-feature ${i % 2 ? "rev" : ""}`}>
                {img(it.imageIndex) && <img src={img(it.imageIndex)!} alt="" />}
                <div className="dp-feature-text">
                  {IE(i, "extra", "dp-feature-label")}
                  {IE(i, "title", "dp-feature-title")}
                  {IE(i, "desc", "dp-feature-desc")}
                </div>
              </div>
            ))}
          </div>
        </>
      );

    case "detail":
      return (
        <>
          {head}
          {mainImg && <img className="dp-wide-img" src={mainImg} alt="" />}
          <div className="dp-points">
            {s.items.map((_, i) => (
              <div key={i} className="dp-point">
                <span className="dp-point-no">{String(i + 1).padStart(2, "0")}</span>
                <div>
                  {IE(i, "title", "dp-point-title")}
                  {IE(i, "desc", "dp-point-desc")}
                </div>
              </div>
            ))}
          </div>
        </>
      );

    case "howto":
      return (
        <>
          {head}
          <div className="dp-steps">
            {s.items.map((_, i) => (
              <div key={i} className="dp-step">
                <div className="dp-step-no">STEP {i + 1}</div>
                {IE(i, "title", "dp-step-title")}
                {IE(i, "desc", "dp-step-desc")}
              </div>
            ))}
          </div>
        </>
      );

    case "target":
    case "notice":
      return (
        <>
          {head}
          <ul className="dp-checks">
            {s.items.map((_, i) => (
              <li key={i}>
                <span className="dp-check">✓</span>
                <div>
                  {IE(i, "title", "dp-check-title")}
                  {(editable || s.items[i].desc) && IE(i, "desc", "dp-check-desc")}
                </div>
              </li>
            ))}
          </ul>
        </>
      );

    case "comparison":
      return (
        <>
          {head}
          <table className="dp-compare">
            <thead>
              <tr>
                <th></th>
                <th className="ours">우리 제품</th>
                <th>일반 제품</th>
              </tr>
            </thead>
            <tbody>
              {s.items.map((_, i) => (
                <tr key={i}>
                  <th>{IE(i, "title", "")}</th>
                  <td className="ours">{IE(i, "desc", "")}</td>
                  <td>{IE(i, "extra", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );

    case "spec":
      return (
        <>
          {head}
          <table className="dp-spec">
            <tbody>
              {s.items.map((_, i) => (
                <tr key={i}>
                  <th>{IE(i, "title", "")}</th>
                  <td>{IE(i, "desc", "")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      );

    case "faq":
      return (
        <>
          {head}
          <div className="dp-faq">
            {s.items.map((_, i) => (
              <div key={i} className="dp-qa">
                <div className="dp-q">
                  <b>Q</b>
                  {IE(i, "title", "")}
                </div>
                <div className="dp-a">
                  <b>A</b>
                  {IE(i, "desc", "")}
                </div>
              </div>
            ))}
          </div>
        </>
      );

    case "cta":
      return (
        <>
          {mainImg && <img className="dp-cta-img" src={mainImg} alt="" />}
          <div className="dp-cta-box">
            {E("eyebrow", "dp-eyebrow", "라벨")}
            {E("title", "dp-cta-title", "마무리 카피")}
            {E("body", "dp-cta-sub", "서브 카피")}
          </div>
        </>
      );

    case "solution":
    default:
      return (
        <>
          {head}
          {mainImg && <img className="dp-wide-img" src={mainImg} alt="" />}
          {s.items.length > 0 && (
            <ul className="dp-checks compact">
              {s.items.map((_, i) => (
                <li key={i}>
                  <span className="dp-check">✓</span>
                  {IE(i, "title", "dp-check-title")}
                </li>
              ))}
            </ul>
          )}
        </>
      );
  }
}
