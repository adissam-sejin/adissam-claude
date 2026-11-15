"use client";
import { wongojiLayout } from "./wongoji";
import { koDate, koShort } from "./date";
import { PERSIMMON, gridSvg } from "./pixel";

export type PdfNote = { note_date: string; content: string; photoUrl?: string | null };

const W = 794; // A4 @96dpi
const H = 1123;
const COLS = 20;
const GRID = "#e98a6c";

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    return await new Promise((r) => {
      const fr = new FileReader();
      fr.onload = () => r(fr.result as string);
      fr.onerror = () => r(null);
      fr.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

function el(tag: string, style: Partial<CSSStyleDeclaration>, html = "") {
  const e = document.createElement(tag);
  Object.assign(e.style, style);
  if (html) e.innerHTML = html;
  return e;
}

function page() {
  return el("div", {
    width: `${W}px`, height: `${H}px`, background: "#fff8ee", boxSizing: "border-box",
    padding: "56px 64px", position: "relative", fontFamily: "'Gowun Batang', serif", color: "#3b2a1e",
    display: "flex", flexDirection: "column", alignItems: "center",
  });
}

function wongoji(text: string, maxH: number) {
  const { cells, end } = wongojiLayout(text, COLS);
  const rows = Math.max(3, Math.ceil(end / COLS));
  const maxW = W - 128;
  const cell = Math.max(14, Math.min(Math.floor(maxW / COLS), Math.floor(maxH / rows / 1.22)));
  const gap = Math.round(cell * 0.22);
  const wrap = el("div", {
    display: "grid", gridTemplateColumns: `repeat(${COLS}, ${cell}px)`, rowGap: `${gap}px`,
    border: `2px solid ${GRID}`, padding: `${gap}px 0`, background: "#fbf1e6",
  });
  for (let i = 0; i < rows * COLS; i++) {
    const c = el("div", {
      width: `${cell}px`, height: `${cell}px`, boxSizing: "border-box", background: "#fffdf8",
      borderTop: `1px solid ${GRID}`, borderBottom: `1px solid ${GRID}`, borderRight: `1px solid ${GRID}`,
      borderLeft: i % COLS === 0 ? `1px solid ${GRID}` : "0",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: `${Math.round(cell * 0.68)}px`, lineHeight: "1",
    });
    c.textContent = cells[i] ?? "";
    wrap.appendChild(c);
  }
  return wrap;
}

function footer(p: HTMLElement, n: number, total: number) {
  p.appendChild(el("div", {
    position: "absolute", bottom: "28px", left: "0", right: "0", textAlign: "center",
    fontSize: "12px", color: "#3b2a1e88", fontFamily: "Galmuri11, monospace",
  }, `감사노트 · ${n} / ${total}`));
}

export async function exportNotesPdf(opts: {
  notes: PdfNote[]; nickname: string; from: string; to: string;
  onProgress?: (done: number, total: number) => void;
}) {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import("html2canvas-pro"), import("jspdf")]);
  await document.fonts.ready;

  const host = el("div", { position: "fixed", left: "-10000px", top: "0", zIndex: "-1" });
  document.body.appendChild(host);

  const pdf = new jsPDF({ unit: "px", format: [W, H], orientation: "portrait", hotfixes: ["px_scaling"] });
  const persimmon = `data:image/svg+xml;utf8,${encodeURIComponent(gridSvg(PERSIMMON, 10))}`;
  const total = opts.notes.length + 1;

  const render = async (p: HTMLElement, first: boolean) => {
    host.innerHTML = "";
    host.appendChild(p);
    await Promise.all(Array.from(p.querySelectorAll("img")).map((im) => im.complete ? null : new Promise((r) => { im.onload = im.onerror = r; })));
    const canvas = await html2canvas(p, { scale: 2, backgroundColor: "#fff8ee", useCORS: true, logging: false });
    if (!first) pdf.addPage([W, H], "portrait");
    pdf.addImage(canvas.toDataURL("image/jpeg", 0.88), "JPEG", 0, 0, W, H);
  };

  try {
    // 표지
    const cover = page();
    cover.style.justifyContent = "center";
    cover.appendChild(el("img", { width: "140px", height: "140px", imageRendering: "pixelated" })).setAttribute("src", persimmon);
    cover.appendChild(el("div", { fontFamily: "Galmuri11, monospace", fontSize: "44px", fontWeight: "700", marginTop: "28px" }, "감사노트"));
    cover.appendChild(el("div", { fontSize: "22px", marginTop: "18px" }, `${opts.from.replace("-", ". ")} ~ ${opts.to.replace("-", ". ")}`));
    cover.appendChild(el("div", { fontSize: "20px", marginTop: "40px" }, `${escapeHtml(opts.nickname)}님의 감사 ${opts.notes.length}개`));
    footer(cover, 1, total);
    await render(cover, true);
    opts.onProgress?.(1, total);

    for (let i = 0; i < opts.notes.length; i++) {
      const n = opts.notes[i];
      const p = page();
      p.appendChild(el("div", {
        width: "100%", display: "flex", justifyContent: "space-between", alignItems: "flex-end",
        borderBottom: "3px solid #3b2a1e", paddingBottom: "10px", marginBottom: "24px",
      }, `<span style="font-size:24px;font-weight:700">${koDate(n.note_date)}</span><span style="font-family:Galmuri11,monospace;font-size:13px;color:#d2601a">${koShort(n.note_date)}</span>`));
      let used = 56 + 50 + 24 + 60;
      if (n.photoUrl) {
        const data = await toDataUrl(n.photoUrl);
        if (data) {
          const img = el("img", { width: "380px", height: "380px", objectFit: "cover", border: "3px solid #3b2a1e", marginBottom: "24px" }) as HTMLImageElement;
          img.src = data;
          p.appendChild(img);
          used += 410;
        }
      }
      p.appendChild(wongoji(n.content, H - used - 40));
      footer(p, i + 2, total);
      await render(p, false);
      opts.onProgress?.(i + 2, total);
    }
    pdf.save(`감사노트_${opts.from}_${opts.to}.pdf`);
  } finally {
    host.remove();
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}
