// 파비콘 · 앱 아이콘 · 오픈그래프 이미지 생성:  npm run assets
import sharp from "sharp";
import { mkdirSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { persimmonSvg, treeSvg } from "../src/lib/illust";

const PUB = path.resolve(__dirname, "../public");
mkdirSync(path.join(PUB, "icons"), { recursive: true });
const inner = (svg: string) => svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");

async function icon(size: number, file: string, { radius = 0, pad = 0.14, bg = "#FFF1E4" } = {}) {
  const art = size * (1 - pad * 2);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <rect width="${size}" height="${size}" rx="${radius}" fill="${bg}"/>
    <svg x="${(size - art) / 2}" y="${(size - art) / 2 + size * 0.02}" width="${art}" height="${art}" viewBox="0 0 100 100">${inner(persimmonSvg({ face: true }))}</svg>
  </svg>`;
  await sharp(Buffer.from(svg)).png().toFile(path.join(PUB, file));
}

(async () => {
  await icon(180, "icons/apple-touch-icon.png");
  await icon(192, "icons/icon-192.png", { radius: 42 });
  await icon(512, "icons/icon-512.png", { radius: 112 });
  await icon(512, "icons/maskable-512.png", { pad: 0.24 });
  writeFileSync(path.join(PUB, "icons/icon.svg"), persimmonSvg({ face: true }));

  const favs = await Promise.all([16, 32, 48].map((s) => sharp(Buffer.from(persimmonSvg({ face: s >= 32 }))).resize(s, s).png().toBuffer()));
  favs.forEach((b, i) => writeFileSync(path.join(PUB, `icons/favicon-${[16, 32, 48][i]}.png`), b));
  const header = Buffer.alloc(6 + 3 * 16);
  header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(3, 4);
  let off = header.length;
  [16, 32, 48].forEach((s, i) => {
    const e = 6 + i * 16;
    header.writeUInt8(s, e); header.writeUInt8(s, e + 1);
    header.writeUInt16LE(1, e + 4); header.writeUInt16LE(32, e + 6);
    header.writeUInt32LE(favs[i].length, e + 8); header.writeUInt32LE(off, e + 12);
    off += favs[i].length;
  });
  writeFileSync(path.join(PUB, "favicon.ico"), Buffer.concat([header, ...favs]));

  // 오픈그래프 (한글 글꼴 렌더링을 위해 Playwright 사용)
  const require = createRequire(__filename);
  const { chromium } = require("playwright");
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await p.setContent(`<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <style>
    html,body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Pretendard,sans-serif;background:#FFF8EE;color:#222}
    .l{position:absolute;left:72px;top:140px}
    .tag{color:#FF7A1A;font-weight:700;font-size:30px}
    h1{margin:16px 0 0;font-size:62px;line-height:1.25;font-weight:800;letter-spacing:-2px}
    h1 b{color:#FF7A1A}
    p{margin:26px 0 0;font-size:30px;color:#8a8a8a;font-weight:500}
    .card{position:absolute;right:80px;top:70px;width:400px;height:490px;border-radius:44px;background:#FF7A1A;box-shadow:0 14px 0 #e2600c}
    .circle{position:absolute;left:50px;top:60px;width:300px;height:300px;border-radius:50%;background:#fff;overflow:hidden;display:flex;align-items:flex-end;justify-content:center}
    .circle svg{width:88%;margin-bottom:-4px}
    .chip{position:absolute;left:50%;transform:translateX(-50%);top:390px;background:#fff;border-radius:999px;padding:10px 24px;font-weight:700;font-size:26px;white-space:nowrap}
    .pc{position:absolute;right:30px;top:30px;width:130px;transform:rotate(12deg)}
  </style></head><body>
  <div class="l"><div class="tag">감사노트 · Gratitude Note</div>
  <h1>매일 감사한 일을 적고<br>나만의 <b>감나무</b>를 키워요</h1>
  <p>감사한 만큼 감이 열리는 감 농장</p></div>
  <div class="card"><div class="circle">${treeSvg(130)}</div><div class="chip">Lv.6 감나무 · 감 30개</div></div>
  <div class="pc">${persimmonSvg({ face: true })}</div>
  </body></html>`);
  await p.waitForTimeout(600);
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(PUB, "og-image.png") });
  await b.close();
  console.log("done");
})();
