"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { TopBar } from "@/components/TopBar";
import { Editor } from "@/components/Editor";
import { fileToResizedDataUrl } from "@/lib/image";
import { STYLE_PRESETS } from "@/lib/channels";
import { SECTION_LABELS, SECTION_TYPES, emptyInput, type Analysis, type Page, type Plan, type ProductInput, type SectionType, type Theme } from "@/lib/schema";
import { listProjects, loadProject, newId, saveProject, deleteProject, uploadImage, type ProjectSummary } from "@/lib/store";
import { useMe } from "@/lib/useMe";
import { COSTS } from "@/lib/pricing";
import Link from "next/link";

type Step = "input" | "plan" | "generating" | "edit";
const MAX_IMAGES = 8;

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

async function post<T>(url: string, body: unknown): Promise<T & { demo?: boolean; credits?: number }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `요청 실패 (${res.status})`, res.status);
  return data;
}

export default function CreatePage() {
  const [id, setId] = useState<string>("");
  const [step, setStep] = useState<Step>("input");
  const [images, setImages] = useState<string[]>([]);
  const [input, setInput] = useState<ProductInput>(emptyInput);
  const [usp, setUsp] = useState<string[]>([]);
  const [brandColor, setBrandColor] = useState("");
  const [style, setStyle] = useState<Theme["style"] | "">("");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [page, setPage] = useState<Page | null>(null);
  const [busy, setBusy] = useState<"" | "analyze" | "plan" | "generate">("");
  const [error, setError] = useState("");
  const [demo, setDemo] = useState(false);
  const [recent, setRecent] = useState<ProjectSummary[]>([]);
  const [uploading, setUploading] = useState(false);
  const [needCredits, setNeedCredits] = useState(false);
  const { me, setCredits } = useMe();
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // 로그인 필요
  useEffect(() => {
    if (me && !me.user) window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }, [me]);

  // 프로젝트 불러오기 (?id=...)
  useEffect(() => {
    if (!me?.user) return;
    const qid = new URLSearchParams(window.location.search).get("id");
    if (qid) {
      loadProject(qid).then((p) => {
        if (!p) return setId(newId());
        setId(p.id);
        setInput(p.input);
        setImages(p.images);
        setPlan(p.plan);
        setPage(p.page);
        setStep(p.page ? "edit" : p.plan ? "plan" : "input");
      });
    } else {
      setId(newId());
    }
    listProjects().then(setRecent);
  }, [me?.user]);

  // 자동 저장
  useEffect(() => {
    if (!id || !me?.user || (!images.length && !input.productName)) return;
    const t = setTimeout(() => saveProject({ id, updatedAt: Date.now(), input, images, plan, page }), 600);
    return () => clearTimeout(t);
  }, [id, input, images, plan, page, me?.user]);

  useEffect(() => {
    if (id && step !== "input") window.history.replaceState(null, "", `/create?id=${id}`);
  }, [id, step]);

  const addFiles = useCallback(
    async (files: FileList | File[]) => {
      const list = Array.from(files).filter((f) => f.type.startsWith("image/")).slice(0, MAX_IMAGES - images.length);
      if (!list.length) return;
      setUploading(true);
      setError("");
      try {
        const urls = await Promise.all(list.map(async (f) => uploadImage(await fileToResizedDataUrl(f), id)));
        setImages((prev) => [...prev, ...urls].slice(0, MAX_IMAGES));
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [images.length, id],
  );

  const set = (k: keyof ProductInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setInput((p) => ({ ...p, [k]: e.target.value }));

  function onApiError(e: unknown) {
    setError((e as Error).message);
    setNeedCredits(e instanceof ApiError && e.status === 402);
    if (e instanceof ApiError && e.status === 401) window.location.href = `/login?next=${encodeURIComponent(`/create?id=${id}`)}`;
  }

  async function analyze() {
    setError("");
    setBusy("analyze");
    try {
      const a = await post<Analysis>("/api/analyze", { images, input });
      setDemo(!!a.demo);
      setInput((p) => ({
        ...p,
        productName: p.productName || a.productName,
        category: p.category || a.category,
        features: p.features || a.features,
        target: p.target || a.target,
        mood: p.mood || a.mood,
      }));
      setUsp(a.usp);
      if (!brandColor && /^#[0-9a-f]{6}$/i.test(a.suggestedPrimary)) setBrandColor(a.suggestedPrimary);
    } catch (e) {
      onApiError(e);
    } finally {
      setBusy("");
    }
  }

  async function makePlan() {
    setError("");
    setBusy("plan");
    try {
      const withUsp = usp.length && !input.features.includes(usp[0]) ? { ...input, features: `${input.features}\n핵심 판매 포인트: ${usp.join(", ")}`.trim() } : input;
      const p = await post<Plan>("/api/plan", { images, input: withUsp });
      setDemo(!!p.demo);
      setPlan(p);
      setStep("plan");
    } catch (e) {
      onApiError(e);
    } finally {
      setBusy("");
    }
  }

  async function generate() {
    if (!plan) return;
    setError("");
    setBusy("generate");
    setStep("generating");
    try {
      const pg = await post<Page>("/api/generate", { images, input, plan, brandColor: brandColor || undefined });
      setDemo(!!pg.demo);
      if (typeof pg.credits === "number") setCredits(pg.credits);
      delete pg.demo;
      delete pg.credits;
      if (style) {
        const preset = STYLE_PRESETS.find((s) => s.id === style)!;
        pg.theme = { ...pg.theme, style, background: preset.sample.background, accent: style === "premium" ? preset.sample.accent : pg.theme.accent };
      }
      setPage(pg);
      setStep("edit");
    } catch (e) {
      onApiError(e);
      setStep("plan");
    } finally {
      setBusy("");
    }
  }

  const canAnalyze = images.length > 0 && !busy;
  const canPlan = (images.length > 0 || input.productName.trim()) && input.productName.trim() && !busy;

  if (!me?.user) {
    return (
      <>
        <TopBar />
        <div className="loading-card"><div className="spinner dark big-spin" /></div>
      </>
    );
  }

  if (step === "edit" && page) {
    return (
      <>
        {demo && <div className="demo-banner">데모 모드: AI 키가 아직 설정되지 않아 샘플 결과를 보여주고 있어요. (크레딧은 차감되지 않아요)</div>}
        <Editor
          page={page}
          setPage={setPage}
          images={images}
          setImages={setImages}
          projectId={id}
          input={input}
          onBackToPlan={() => setStep("plan")}
        />
      </>
    );
  }

  const stepIdx = { input: 0, plan: 1, generating: 2, edit: 3 }[step];
  const labels = ["상품 정보", "기획 초안", "생성", "편집·내보내기"];

  return (
    <>
      <TopBar />
      {demo && <div className="demo-banner">데모 모드: API 키가 없어 샘플 결과를 보여주고 있어요.</div>}
      <main className="wizard">
        <div className="stepper">
          {labels.map((l, i) => (
            <div key={l} className={`st ${i === stepIdx ? "on" : ""} ${i < stepIdx ? "done" : ""}`}>
              <span className="n">{i < stepIdx ? "✓" : i + 1}</span>
              {l}
            </div>
          ))}
        </div>

        {error && (
          <div className="error-box" style={{ marginBottom: 16 }}>
            {error} {needCredits && <Link href="/pricing" style={{ textDecoration: "underline", fontWeight: 700 }}>크레딧 충전하기 →</Link>}
          </div>
        )}

        {step === "input" && (
          <div className="stack">
            <div className="card stack">
              <div className="row between">
                <div>
                  <h2 style={{ margin: 0, fontSize: 22 }}>상품 사진</h2>
                  <p className="muted" style={{ margin: "4px 0 0", fontSize: 14 }}>최대 {MAX_IMAGES}장. 첫 번째 사진이 대표 이미지로 쓰여요.</p>
                </div>
                <button className="btn btn-dark" disabled={!canAnalyze} onClick={analyze}>
                  {busy === "analyze" ? <span className="spinner" /> : "AI"} 사진으로 자동 채우기
                </button>
              </div>
              <div
                className={`dropzone ${dragOver ? "over" : ""}`}
                onClick={() => fileRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  addFiles(e.dataTransfer.files);
                }}
              >
                <b>{uploading ? "업로드 중…" : "사진을 끌어다 놓거나 클릭해서 선택"}</b>
                <div className="muted" style={{ fontSize: 13, marginTop: 6 }}>JPG · PNG · WEBP, 스마트폰 사진도 괜찮아요</div>
                <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => e.target.files && addFiles(e.target.files)} />
              </div>
              {images.length > 0 && (
                <div className="thumbs">
                  {images.map((src, i) => (
                    <div key={i} className="thumb">
                      <img src={src} alt="" />
                      <span className="idx">{i === 0 ? "대표" : i + 1}</span>
                      <button className="x" onClick={() => setImages((p) => p.filter((_, j) => j !== i))}>✕</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card stack">
              <h2 style={{ margin: 0, fontSize: 22 }}>상품 정보</h2>
              <div className="grid2">
                <div className="field">
                  <label>상품명 *</label>
                  <input className="input" value={input.productName} onChange={set("productName")} placeholder="예) 데일리 텀블러 500ml" />
                </div>
                <div className="field">
                  <label>카테고리</label>
                  <input className="input" value={input.category} onChange={set("category")} placeholder="예) 주방용품" />
                </div>
              </div>
              <div className="field">
                <label>
                  장점·특징 <span className="hint">— 고객에게 꼭 전하고 싶은 것을 자유롭게</span>
                </label>
                <textarea className="textarea" value={input.features} onChange={set("features")} placeholder={"예) 이중 진공이라 하루 종일 따뜻해요\n한 손으로 여는 원터치 뚜껑\n가방에 넣어도 새지 않아요"} />
              </div>
              {usp.length > 0 && (
                <div className="field">
                  <label>AI가 찾은 핵심 판매 포인트 (USP)</label>
                  <div className="usp-chips">
                    {usp.map((u, i) => (
                      <span key={i} className="tag tag-brand">
                        {u}
                        <button className="icon-btn" style={{ width: 18, height: 18 }} onClick={() => setUsp((p) => p.filter((_, j) => j !== i))}>✕</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="grid2">
                <div className="field">
                  <label>타깃 고객</label>
                  <input className="input" value={input.target} onChange={set("target")} placeholder="예) 출퇴근하는 30대 직장인" />
                </div>
                <div className="field">
                  <label>가격</label>
                  <input className="input" value={input.price} onChange={set("price")} placeholder="예) 24,900원" />
                </div>
              </div>
              <div className="field">
                <label>
                  추가 정보 <span className="hint">— 옵션, 구성품, 소재, 인증, 배송 등 (적어 주신 사실만 사용해요)</span>
                </label>
                <textarea className="textarea" style={{ minHeight: 70 }} value={input.extra} onChange={set("extra")} placeholder="예) 색상 3종(화이트/블랙/세이지), 스테인리스 304, KC 인증 완료" />
              </div>
            </div>

            <div className="card stack">
              <h2 style={{ margin: 0, fontSize: 22 }}>디자인 분위기</h2>
              <div className="style-pick">
                {STYLE_PRESETS.map((s) => (
                  <button key={s.id} className={`style-opt ${style === s.id ? "on" : ""}`} onClick={() => setStyle(style === s.id ? "" : s.id)}>
                    <div className="sw">
                      <i style={{ background: s.sample.primary }} />
                      <i style={{ background: s.sample.accent }} />
                      <i style={{ background: s.sample.background }} />
                    </div>
                    <b>{s.name}</b>
                    <span>{s.desc}</span>
                  </button>
                ))}
              </div>
              <div className="grid2">
                <div className="field">
                  <label>원하는 분위기 (선택)</label>
                  <input className="input" value={input.mood} onChange={set("mood")} placeholder="예) 깔끔하고 산뜻하게" />
                </div>
                <div className="field">
                  <label>브랜드 메인 컬러 (선택)</label>
                  <div className="row">
                    <input type="color" value={brandColor || "#ff5a36"} onChange={(e) => setBrandColor(e.target.value)} style={{ width: 46, height: 44, border: "1px solid var(--line)", borderRadius: 10, padding: 3 }} />
                    <span className="muted" style={{ fontSize: 14 }}>{brandColor || "AI가 사진에 맞춰 골라요"}</span>
                    {brandColor && <button className="btn btn-sm btn-ghost" onClick={() => setBrandColor("")}>초기화</button>}
                  </div>
                </div>
              </div>
            </div>

            <div className="row between">
              <span className="muted" style={{ fontSize: 13 }}>기획 초안은 몇 번이든 다시 만들 수 있어요.</span>
              <button className="btn btn-primary btn-lg" disabled={!canPlan} onClick={makePlan}>
                {busy === "plan" ? <span className="spinner" /> : null} 기획 초안 만들기 →
              </button>
            </div>

            {recent.length > 0 && (
              <div className="card">
                <h3 style={{ margin: "0 0 12px", fontSize: 16 }}>최근 작업</h3>
                <div className="stack" style={{ gap: 8 }}>
                  {recent.slice(0, 6).map((p) => (
                    <div key={p.id} className="row between" style={{ fontSize: 14 }}>
                      <a href={`/create?id=${p.id}`} className="row" style={{ gap: 10 }}>
                        {p.thumbnail && <img src={p.thumbnail} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />}
                        <b>{p.title}</b>
                        <span className="muted">{p.status} · {new Date(p.updatedAt).toLocaleString("ko-KR")}</span>
                      </a>
                      <button
                        className="icon-btn"
                        title="삭제"
                        onClick={async () => {
                          await deleteProject(p.id);
                          setRecent((r) => r.filter((x) => x.id !== p.id));
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {step === "plan" && plan && (
          <div className="stack">
            <div className="card stack">
              <div className="field">
                <label>콘셉트</label>
                <input className="input" value={plan.concept} onChange={(e) => setPlan({ ...plan, concept: e.target.value })} />
              </div>
              <div className="field">
                <label>첫 화면 후킹 카피</label>
                <textarea className="textarea" style={{ minHeight: 64 }} value={plan.hookCopy} onChange={(e) => setPlan({ ...plan, hookCopy: e.target.value })} />
              </div>
              <div className="usp-chips">
                {plan.usp.map((u, i) => (
                  <span key={i} className="tag tag-brand">{u}</span>
                ))}
              </div>
            </div>

            <div className="card stack">
              <div className="row between">
                <h2 style={{ margin: 0, fontSize: 20 }}>섹션 구성 ({plan.sections.length})</h2>
                <select
                  className="select"
                  style={{ width: "auto" }}
                  value=""
                  onChange={(e) => {
                    const type = e.target.value as SectionType;
                    if (!type) return;
                    const secs = [...plan.sections];
                    const ctaIdx = secs.findIndex((s) => s.type === "cta");
                    secs.splice(ctaIdx >= 0 ? ctaIdx : secs.length, 0, { type, purpose: "", keyMessage: "" });
                    setPlan({ ...plan, sections: secs });
                  }}
                >
                  <option value="">+ 섹션 추가</option>
                  {SECTION_TYPES.map((t) => (
                    <option key={t} value={t}>{SECTION_LABELS[t]}</option>
                  ))}
                </select>
              </div>
              <div className="plan-list">
                {plan.sections.map((s, i) => {
                  const update = (patch: Partial<typeof s>) => setPlan({ ...plan, sections: plan.sections.map((x, j) => (j === i ? { ...x, ...patch } : x)) });
                  const move = (d: number) => {
                    const secs = [...plan.sections];
                    const [m] = secs.splice(i, 1);
                    secs.splice(Math.max(0, Math.min(secs.length, i + d)), 0, m);
                    setPlan({ ...plan, sections: secs });
                  };
                  return (
                    <div key={i} className="plan-item">
                      <span className="no">{i + 1}</span>
                      <select className="select input" value={s.type} onChange={(e) => update({ type: e.target.value as SectionType })}>
                        {SECTION_TYPES.map((t) => (
                          <option key={t} value={t}>{SECTION_LABELS[t]}</option>
                        ))}
                      </select>
                      <input className="input msg" value={s.keyMessage} placeholder="이 섹션의 핵심 메시지" onChange={(e) => update({ keyMessage: e.target.value })} />
                      <div className="acts">
                        <button className="icon-btn" onClick={() => move(-1)} title="위로">↑</button>
                        <button className="icon-btn" onClick={() => move(1)} title="아래로">↓</button>
                        <button className="icon-btn" onClick={() => setPlan({ ...plan, sections: plan.sections.filter((_, j) => j !== i) })} title="삭제">✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="row between">
              <div className="row">
                <button className="btn" onClick={() => setStep("input")}>← 정보 수정</button>
                <button className="btn" disabled={!!busy} onClick={makePlan}>
                  {busy === "plan" ? <span className="spinner dark" /> : "↻"} 초안 다시 만들기
                </button>
                {page && <button className="btn" onClick={() => setStep("edit")}>편집기로 돌아가기</button>}
              </div>
              <button className="btn btn-primary btn-lg" disabled={!!busy || plan.sections.length === 0} onClick={generate} title={`보유 ${me?.credits ?? 0} 크레딧`}>
                이대로 상세페이지 만들기 · {COSTS.generate} 크레딧 →
              </button>
            </div>
          </div>
        )}

        {step === "generating" && (
          <div className="card loading-card">
            <div className="spinner dark big-spin" />
            <h2 style={{ margin: "0 0 8px" }}>상세페이지를 만들고 있어요</h2>
            <p className="muted" style={{ margin: 0 }}>카피 작성 → 사진 배치 → 컬러·레이아웃 구성 중… 보통 1~3분 걸려요.</p>
          </div>
        )}
      </main>
    </>
  );
}
