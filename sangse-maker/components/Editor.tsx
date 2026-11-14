"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { DetailPage } from "./DetailPage";
import { CHANNELS, STYLE_PRESETS } from "@/lib/channels";
import { exportPage, downloadBlob, type ExportFormat } from "@/lib/export";
import { SECTION_LABELS, SECTION_TYPES, emptySection, type Page, type ProductInput, type Section, type SectionType } from "@/lib/schema";
import { COSTS } from "@/lib/pricing";
import { useMe, } from "@/lib/useMe";
import { UserMenu } from "./TopBar";

const SCENES: { id: string; label: string }[] = [
  { id: "lifestyle", label: "사용 장면" },
  { id: "studio", label: "스튜디오 배경" },
  { id: "detail", label: "디테일 클로즈업" },
  { id: "outdoor", label: "야외·자연광" },
  { id: "premium", label: "프리미엄 무드" },
  { id: "flatlay", label: "플랫레이" },
];

const QUICK_ASKS = ["더 짧고 임팩트 있게", "더 고급스러운 말투로", "20대 친근한 말투로", "혜택이 더 와닿게", "항목 하나 더 추가"];
const HISTORY_LIMIT = 60;

export function Editor({
  page,
  setPage,
  images,
  setImages,
  projectId,
  input,
  onBackToPlan,
}: {
  page: Page;
  setPage: (p: Page) => void;
  images: string[];
  setImages: (fn: (prev: string[]) => string[]) => void;
  projectId: string;
  input: ProductInput;
  onBackToPlan: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(0);
  const [past, setPast] = useState<Page[]>([]);
  const [future, setFuture] = useState<Page[]>([]);
  const [ask, setAsk] = useState("");
  const [revising, setRevising] = useState(false);
  const [reviseErr, setReviseErr] = useState("");
  const [channel, setChannel] = useState<string>(CHANNELS[0].id);
  const [format, setFormat] = useState<ExportFormat>("jpg");
  const [exporting, setExporting] = useState<string>("");
  const frameRef = useRef<HTMLDivElement>(null);
  const { me, setCredits } = useMe();
  const [imgSrc, setImgSrc] = useState(0);
  const [scene, setScene] = useState("lifestyle");
  const [sceneText, setSceneText] = useState("");
  const [ratio, setRatio] = useState("1:1");
  const [imgBusy, setImgBusy] = useState(false);
  const [imgErr, setImgErr] = useState("");

  async function makeImage() {
    setImgBusy(true);
    setImgErr("");
    try {
      const res = await fetch("/api/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceUrl: images[imgSrc], scene, custom: sceneText, aspectRatio: ratio, projectId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "이미지 생성 실패");
      if (typeof data.credits === "number") setCredits(data.credits);
      const newIndex = images.length;
      setImages((prev) => [...prev, data.url]);
      // 선택한 섹션이 있으면 바로 적용
      if (selected !== null && sel) updateSection(selected, { ...sel, imageIndex: newIndex });
    } catch (e) {
      setImgErr((e as Error).message);
    } finally {
      setImgBusy(false);
    }
  }

  /** 모든 변경은 commit 을 거쳐 되돌리기 기록에 남는다 */
  const commit = useCallback(
    (next: Page) => {
      setPast((p) => [...p.slice(-HISTORY_LIMIT), page]);
      setFuture([]);
      setPage(next);
    },
    [page, setPage],
  );
  const undo = useCallback(() => {
    if (!past.length) return;
    setFuture((f) => [page, ...f]);
    setPage(past[past.length - 1]);
    setPast((p) => p.slice(0, -1));
  }, [past, page, setPage]);
  const redo = useCallback(() => {
    if (!future.length) return;
    setPast((p) => [...p, page]);
    setPage(future[0]);
    setFuture((f) => f.slice(1));
  }, [future, page, setPage]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.isContentEditable || ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        e.shiftKey ? redo() : undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo, redo]);

  const sections = page.sections;
  const sel = selected !== null ? sections[selected] : null;

  const updateSection = (i: number, s: Section) => commit({ ...page, sections: sections.map((x, j) => (j === i ? s : x)) });
  const move = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= sections.length) return;
    const secs = [...sections];
    [secs[i], secs[j]] = [secs[j], secs[i]];
    commit({ ...page, sections: secs });
    setSelected(j);
  };
  const remove = (i: number) => {
    commit({ ...page, sections: sections.filter((_, j) => j !== i) });
    setSelected(null);
  };
  const duplicate = (i: number) => {
    const secs = [...sections];
    secs.splice(i + 1, 0, structuredClone(sections[i]));
    commit({ ...page, sections: secs });
    setSelected(i + 1);
  };
  const addSection = (type: SectionType) => {
    const at = selected !== null ? selected + 1 : sections.length;
    const secs = [...sections];
    secs.splice(at, 0, emptySection(type));
    commit({ ...page, sections: secs });
    setSelected(at);
    setTimeout(() => frameRef.current?.querySelectorAll("[data-export-section]")[at]?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  async function revise(instruction: string) {
    if (selected === null || !sel || !instruction.trim()) return;
    setRevising(true);
    setReviseErr("");
    try {
      const res = await fetch("/api/revise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ section: sel, instruction, input }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "수정 실패");
      if (typeof data.credits === "number") setCredits(data.credits);
      delete data.demo;
      delete data.credits;
      const fix = (n: number) => (n >= 0 && n < images.length ? n : -1);
      updateSection(selected, { ...data, imageIndex: fix(data.imageIndex), items: data.items.map((it: Section["items"][number]) => ({ ...it, imageIndex: fix(it.imageIndex) })) });
      setAsk("");
    } catch (e) {
      setReviseErr((e as Error).message);
    } finally {
      setRevising(false);
    }
  }

  async function doExport() {
    if (!frameRef.current) return;
    const ch = CHANNELS.find((c) => c.id === channel)!;
    setSelected(null);
    setExporting("준비 중…");
    await new Promise((r) => setTimeout(r, 60));
    try {
      const base = (page.productName || "상세페이지").replace(/[\\/:*?"<>|\s]+/g, "_");
      const blob = await exportPage({
        root: frameRef.current,
        width: ch.width,
        format,
        fileBase: `${base}_${ch.width}`,
        onProgress: (d, t) => setExporting(`이미지 만드는 중 ${d}/${t}`),
      });
      downloadBlob(blob, `${base}_${ch.name}_${ch.width}px.zip`);
    } catch (e) {
      alert(`내보내기 실패: ${(e as Error).message}`);
    } finally {
      setExporting("");
    }
  }

  const theme = page.theme;
  const setTheme = (patch: Partial<Page["theme"]>) => commit({ ...page, theme: { ...theme, ...patch } });
  const itemImageTypes: SectionType[] = ["features"];

  return (
    <>
      <header className="topbar">
        <div className="topbar-in" style={{ padding: "0 16px" }}>
          <Link href="/" className="logo">
            <span className="logo-mark">상</span>
            <span>상세메이트</span>
          </Link>
          <div className="row" style={{ gap: 6 }}>
            <button className="btn btn-sm btn-ghost" onClick={undo} disabled={!past.length} title="되돌리기 (Ctrl+Z)">↶ 되돌리기</button>
            <button className="btn btn-sm btn-ghost" onClick={redo} disabled={!future.length} title="다시 실행 (Ctrl+Shift+Z)">↷</button>
            <button className="btn btn-sm" onClick={onBackToPlan}>기획 초안</button>
            <select className="select btn-sm" style={{ width: "auto", height: 36, padding: "0 8px" }} value={channel} onChange={(e) => setChannel(e.target.value)}>
              {CHANNELS.map((c) => (
                <option key={c.id} value={c.id}>{c.name} · {c.width}px</option>
              ))}
            </select>
            <select className="select" style={{ width: "auto", height: 36, padding: "0 8px" }} value={format} onChange={(e) => setFormat(e.target.value as ExportFormat)}>
              <option value="jpg">JPG</option>
              <option value="png">PNG</option>
            </select>
            <button className="btn btn-sm btn-primary" onClick={doExport} disabled={!!exporting}>
              {exporting ? <><span className="spinner" /> {exporting}</> : "내보내기"}
            </button>
            <span style={{ width: 8 }} />
            <UserMenu />
          </div>
        </div>
      </header>

      <div className="editor">
        <div className="editor-canvas" onClick={(e) => e.target === e.currentTarget && setSelected(null)}>
          <div className="frame">
            <DetailPage
              ref={frameRef}
              page={page}
              images={images}
              editable
              selected={selected}
              onSelect={setSelected}
              onSectionChange={updateSection}
            />
          </div>
        </div>

        <aside className="editor-side">
          {sel && selected !== null ? (
            <>
              <div className="side-sec">
                <div className="row between" style={{ marginBottom: 10 }}>
                  <h4 style={{ margin: 0 }}>선택한 섹션 · {SECTION_LABELS[sel.type]}</h4>
                  <div className="row" style={{ gap: 0 }}>
                    <button className="icon-btn" title="위로" onClick={() => move(selected, -1)}>↑</button>
                    <button className="icon-btn" title="아래로" onClick={() => move(selected, 1)}>↓</button>
                    <button className="icon-btn" title="복제" onClick={() => duplicate(selected)}>⧉</button>
                    <button className="icon-btn" title="삭제" onClick={() => remove(selected)}>✕</button>
                  </div>
                </div>
                <p className="muted" style={{ fontSize: 12.5, margin: "0 0 10px" }}>페이지의 글자를 클릭하면 바로 고칠 수 있어요.</p>

                <h4>AI로 고치기 <span className="muted" style={{ fontWeight: 400 }}>· 1회 {COSTS.revise} 크레딧</span></h4>
                <div className="usp-chips" style={{ marginBottom: 8 }}>
                  {QUICK_ASKS.map((q) => (
                    <button key={q} className="tag" style={{ border: 0, cursor: "pointer" }} disabled={revising} onClick={() => revise(q)}>{q}</button>
                  ))}
                </div>
                <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                  <input
                    className="input"
                    style={{ padding: "8px 10px", fontSize: 14 }}
                    placeholder="예) 제목을 질문형으로 바꿔줘"
                    value={ask}
                    onChange={(e) => setAsk(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && revise(ask)}
                  />
                  <button className="btn btn-sm btn-dark" disabled={revising || !ask.trim()} onClick={() => revise(ask)}>
                    {revising ? <span className="spinner" /> : "적용"}
                  </button>
                </div>
                {reviseErr && <div className="error-box" style={{ marginTop: 8, fontSize: 13 }}>{reviseErr}</div>}
              </div>

              {images.length > 0 && (
                <div className="side-sec">
                  <h4>섹션 사진</h4>
                  <div className="img-pick">
                    <button className={sel.imageIndex < 0 ? "on" : ""} onClick={() => updateSection(selected, { ...sel, imageIndex: -1 })}>없음</button>
                    {images.map((src, i) => (
                      <button key={i} className={sel.imageIndex === i ? "on" : ""} onClick={() => updateSection(selected, { ...sel, imageIndex: i })}>
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                  {itemImageTypes.includes(sel.type) &&
                    sel.items.map((it, k) => (
                      <div key={k} style={{ marginTop: 12 }}>
                        <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>{it.extra || `항목 ${k + 1}`} 사진</div>
                        <div className="img-pick">
                          <button className={it.imageIndex < 0 ? "on" : ""} onClick={() => updateSection(selected, { ...sel, items: sel.items.map((x, j) => (j === k ? { ...x, imageIndex: -1 } : x)) })}>없음</button>
                          {images.map((src, i) => (
                            <button key={i} className={it.imageIndex === i ? "on" : ""} onClick={() => updateSection(selected, { ...sel, items: sel.items.map((x, j) => (j === k ? { ...x, imageIndex: i } : x)) })}>
                              <img src={src} alt="" />
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                </div>
              )}

              {!["hero", "cta"].includes(sel.type) && (
                <div className="side-sec">
                  <h4>항목 ({sel.items.length})</h4>
                  <div className="stack" style={{ gap: 4 }}>
                    {sel.items.map((it, k) => (
                      <div key={k} className="sec-row" style={{ cursor: "default" }}>
                        <span className="grow">{it.title || "(빈 항목)"}</span>
                        <button className="icon-btn" title="삭제" onClick={() => updateSection(selected, { ...sel, items: sel.items.filter((_, j) => j !== k) })}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn btn-sm"
                    style={{ marginTop: 8, width: "100%" }}
                    onClick={() => updateSection(selected, { ...sel, items: [...sel.items, { title: "새 항목", desc: sel.type === "comparison" ? "우리 제품" : "설명", extra: sel.type === "comparison" ? "일반 제품" : sel.type === "features" ? `POINT ${String(sel.items.length + 1).padStart(2, "0")}` : "", imageIndex: -1 }] })}
                  >
                    + 항목 추가
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="side-sec">
              <h4>편집 방법</h4>
              <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
                페이지에서 섹션을 클릭해 선택하세요. 글자는 클릭해서 바로 고치고, 오른쪽 패널에서 AI로 고치기·사진 교체·순서 변경을 할 수 있어요.
              </p>
            </div>
          )}

          {images.length > 0 && (
            <div className="side-sec ai-img-panel">
              <h4>AI 연출 이미지 만들기 <span className="muted" style={{ fontWeight: 400 }}>· 1장 {COSTS.image} 크레딧</span></h4>
              {me && !me.features.image ? (
                <p className="muted" style={{ fontSize: 13, margin: 0 }}>AI 이미지 생성이 아직 설정되지 않았어요. (관리자: GEMINI_API_KEY)</p>
              ) : (
                <div className="stack" style={{ gap: 10 }}>
                  <div className="muted" style={{ fontSize: 12 }}>기준 상품 사진</div>
                  <div className="img-pick">
                    {images.map((src, i) => (
                      <button key={i} className={imgSrc === i ? "on" : ""} onClick={() => setImgSrc(i)}>
                        <img src={src} alt="" />
                      </button>
                    ))}
                  </div>
                  <div className="scene-grid">
                    {SCENES.map((sc) => (
                      <button key={sc.id} className={scene === sc.id ? "on" : ""} onClick={() => setScene(sc.id)}>{sc.label}</button>
                    ))}
                  </div>
                  <input className="input" style={{ padding: "8px 10px", fontSize: 13.5 }} placeholder="추가 요청 (예: 원목 식탁 위, 아침 햇살)" value={sceneText} onChange={(e) => setSceneText(e.target.value)} />
                  <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
                    <select className="select" style={{ padding: "7px 8px", fontSize: 13 }} value={ratio} onChange={(e) => setRatio(e.target.value)}>
                      <option value="1:1">정사각 1:1</option>
                      <option value="4:5">세로 4:5</option>
                      <option value="3:4">세로 3:4</option>
                      <option value="4:3">가로 4:3</option>
                      <option value="16:9">와이드 16:9</option>
                    </select>
                    <button className="btn btn-sm btn-dark" style={{ flex: "none" }} disabled={imgBusy} onClick={makeImage}>
                      {imgBusy ? <><span className="spinner" /> 생성 중</> : "만들기"}
                    </button>
                  </div>
                  <p className="muted" style={{ fontSize: 12, margin: 0 }}>{selected !== null ? `완성되면 ${selected + 1}번 섹션에 바로 적용돼요.` : "완성된 이미지는 사진 목록에 추가돼요."}</p>
                  {imgErr && <div className="error-box" style={{ fontSize: 13 }}>{imgErr}</div>}
                </div>
              )}
            </div>
          )}

          <div className="side-sec">
            <h4>스타일 · 브랜드 컬러</h4>
            <div className="style-pick" style={{ gridTemplateColumns: "1fr 1fr", marginBottom: 12 }}>
              {STYLE_PRESETS.map((s) => (
                <button
                  key={s.id}
                  className={`style-opt ${theme.style === s.id ? "on" : ""}`}
                  style={{ padding: 8 }}
                  onClick={() => setTheme({ style: s.id, background: s.sample.background, accent: s.id === "premium" ? s.sample.accent : theme.style === "premium" ? `${theme.primary}1a` : theme.accent })}
                >
                  <b>{s.name}</b>
                </button>
              ))}
            </div>
            <div className="stack" style={{ gap: 8 }}>
              <label className="color-row"><input type="color" value={toHex6(theme.primary)} onChange={(e) => setTheme({ primary: e.target.value })} />메인 컬러</label>
              <label className="color-row"><input type="color" value={toHex6(theme.accent)} onChange={(e) => setTheme({ accent: e.target.value })} />보조 컬러</label>
              <label className="color-row"><input type="color" value={toHex6(theme.background)} onChange={(e) => setTheme({ background: e.target.value })} />배경</label>
            </div>
          </div>

          <div className="side-sec">
            <h4>섹션 목록</h4>
            <div className="sec-list">
              {sections.map((s, i) => (
                <div
                  key={i}
                  className={`sec-row ${selected === i ? "on" : ""}`}
                  onClick={() => {
                    setSelected(i);
                    frameRef.current?.querySelectorAll("[data-export-section]")[i]?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                >
                  <span className="muted" style={{ width: 18, fontSize: 12 }}>{i + 1}</span>
                  <span className="grow">{SECTION_LABELS[s.type]} · {s.title.split("\n")[0]}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="side-sec">
            <h4>블록 추가 {selected !== null ? `(${selected + 1}번 다음에)` : "(맨 아래에)"}</h4>
            <div className="add-grid">
              {SECTION_TYPES.map((t) => (
                <button key={t} onClick={() => addSection(t)}>+ {SECTION_LABELS[t]}</button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </>
  );
}

/** <input type=color> 는 #rrggbb 만 받는다 */
function toHex6(c: string): string {
  if (/^#[0-9a-f]{6}$/i.test(c)) return c;
  if (/^#[0-9a-f]{8}$/i.test(c)) return c.slice(0, 7);
  if (/^#[0-9a-f]{3}$/i.test(c)) return "#" + c.slice(1).split("").map((x) => x + x).join("");
  return "#888888";
}
