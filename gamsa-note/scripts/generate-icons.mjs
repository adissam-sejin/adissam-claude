// 파비콘 · 앱 아이콘 · 오픈그래프 이미지 생성
//   node scripts/generate-icons.mjs
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { PERSIMMON, gridRects, treeGrid, TREE_W, TREE_H } from "../src/lib/pixel.ts";

const OUT = new URL("../public/", import.meta.url).pathname;
mkdirSync(OUT + "icons", { recursive: true });

const rects = (rows, ox = 0, oy = 0, s = 1) =>
  gridRects(rows).map((r) => `<rect x="${ox + r.x * s}" y="${oy + r.y * s}" width="${r.w * s}" height="${s}" fill="${r.c}"/>`).join("");

// 16x16 감을 정수배로 키워 중앙 배치
function iconSvg(size, { bg = "#FFF3E2", radius = 0.22, pad = 0.14 } = {}) {
  const cell = Math.floor((size * (1 - pad * 2)) / 16);
  const art = cell * 16;
  const o = Math.floor((size - art) / 2);
  const r = Math.round(size * radius);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">
    ${bg ? `<rect width="${size}" height="${size}" rx="${r}" fill="${bg}"/>` : ""}
    ${rects(PERSIMMON, o, o + Math.round(cell * 0.3), cell)}
  </svg>`;
}

const png = (svg, file) => sharp(Buffer.from(svg)).png().toFile(OUT + file);

// favicon 용 (배경 없이 감만)
const favSvg = (size) => {
  const cell = size / 16;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges">${rects(PERSIMMON, 0, 0, cell)}</svg>`;
};

await png(favSvg(16), "icons/favicon-16.png");
await png(favSvg(32), "icons/favicon-32.png");
await png(favSvg(48), "icons/favicon-48.png");
writeFileSync(OUT + "icons/icon.svg", `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects(PERSIMMON)}</svg>`);

await png(iconSvg(180, { radius: 0 }), "icons/apple-touch-icon.png"); // iOS가 직접 둥글게 처리
await png(iconSvg(192), "icons/icon-192.png");
await png(iconSvg(512), "icons/icon-512.png");
await png(iconSvg(512, { radius: 0, pad: 0.24 }), "icons/maskable-512.png");

// favicon.ico (PNG 내장 ICO: 16/32/48)
const imgs = [16, 32, 48].map((s) => ({ s, buf: readFileSync(OUT + `icons/favicon-${s}.png`) }));
const header = Buffer.alloc(6 + imgs.length * 16);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(imgs.length, 4);
let offset = header.length;
imgs.forEach(({ s, buf }, i) => {
  const e = 6 + i * 16;
  header.writeUInt8(s, e); header.writeUInt8(s, e + 1); header.writeUInt8(0, e + 2); header.writeUInt8(0, e + 3);
  header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
  header.writeUInt32LE(buf.length, e + 8); header.writeUInt32LE(offset, e + 12);
  offset += buf.length;
});
writeFileSync(OUT + "favicon.ico", Buffer.concat([header, ...imgs.map((i) => i.buf)]));

// ---------- 오픈그래프 1200x630 (Galmuri 폰트로 한글 렌더 → Playwright) ----------
const tree = (count, seed, x, y, s) => rects(treeGrid(count, seed).grid, x, y, s);
const W = 1200, H = 630;
const groundY = 470;
const font = readFileSync(OUT + "fonts/Galmuri11-Bold.woff2").toString("base64");
const ogSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" shape-rendering="crispEdges">
  <rect width="${W}" height="${groundY}" fill="#9AD8FF"/>
  <rect y="${groundY - 120}" width="${W}" height="120" fill="#BDE7FF"/>
  <rect y="${groundY}" width="${W}" height="${H - groundY}" fill="#7CCC53"/>
  ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 32}" y="${groundY + (i % 2) * 16}" width="16" height="16" fill="#6DBB47"/>`).join("")}
  ${Array.from({ length: 40 }, (_, i) => `<rect x="${i * 32 + 16}" y="${groundY + 32 + (i % 2) * 16}" width="16" height="16" fill="#6DBB47"/>`).join("")}
  <rect y="${groundY - 26}" width="${W}" height="7" fill="#C58A52"/>
  <rect y="${groundY - 12}" width="${W}" height="7" fill="#C58A52"/>
  ${Array.from({ length: 50 }, (_, i) => `<rect x="${i * 26}" y="${groundY - 34}" width="9" height="34" fill="#8A5A32"/>`).join("")}
  ${rects(["...HHHH...", ".HHOOOOHH.", ".HOOOOOOH.", "HOOOOOOOOH", "HOOOOOOOOH", "HOOOOOOOOH", "HOOOOOOOOH", ".HOOOOOOH.", ".HHOOOOHH.", "...HHHH..."], 1070, 40, 9)}
  ${tree(10, 11, 40, groundY - TREE_H * 4 + 10, 4)}
  ${tree(160, 3, 170, groundY - TREE_H * 7 + 16, 7)}
  ${tree(140, 9, 820, groundY - TREE_H * 7 + 16, 7)}
  ${tree(70, 5, 1060, groundY - TREE_H * 4 + 10, 4)}
</svg>`;
const ogHtml = `<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:G;src:url(data:font/woff2;base64,${font}) format('woff2');font-weight:700}
html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden}
.t{position:absolute;left:0;right:0;text-align:center;font-family:G;color:#3B2A1E}
.box{position:absolute;left:50%;top:92px;transform:translateX(-50%);background:#FFF8EE;border:6px solid #3B2A1E;box-shadow:10px 10px 0 #3B2A1E;padding:30px 54px 34px;text-align:center;font-family:G;color:#3B2A1E;white-space:nowrap}
.h{font-size:84px;display:flex;align-items:center;gap:22px;justify-content:center}
.s{font-size:30px;margin-top:16px;color:#D2601A}
.f{position:absolute;bottom:40px;left:0;right:0;text-align:center;font-family:G;font-size:30px;color:#fff;text-shadow:3px 3px 0 #2C6B30}
</style></head><body>${ogSvg.replace("<svg", '<svg style="position:absolute;inset:0"')}
<div class="box"><div class="h">${`<svg width="84" height="84" viewBox="0 0 16 16" shape-rendering="crispEdges">${rects(PERSIMMON)}</svg>`}감사노트</div>
<div class="s">감사한 만큼 감이 열리는 감 농장</div></div>
<div class="f">매일 감사 한 줄 · 사진 한 장 · 함께 키우는 감나무</div>
</body></html>`;
writeFileSync(new URL("./og.html", import.meta.url), ogHtml);

const { createRequire } = await import("node:module");
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require("playwright")); } catch { chromium = null; }
if (chromium) {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: W, height: H } });
  await p.setContent(ogHtml);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: OUT + "og-image.png" });
  await b.close();
  console.log("og-image.png 생성 완료");
} else {
  console.log("playwright 가 없어 og-image.png 는 건너뜀 (scripts/og.html 을 1200x630 으로 캡처하세요)");
}
console.log("아이콘 생성 완료");
