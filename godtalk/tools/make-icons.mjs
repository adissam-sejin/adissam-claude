/* 앱 아이콘 만들기 — node tools/make-icons.mjs (Playwright 필요) */
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)(process.env.PLAYWRIGHT_PATH || "playwright");
import path from "node:path";
import { fileURLToPath } from "node:url";
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), "../public/icons");

const svg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#2C3B74"/><stop offset=".5" stop-color="#141B3D"/><stop offset="1" stop-color="#0A0E24"/>
    </linearGradient>
    <radialGradient id="dawn" cx=".5" cy="0" r=".9">
      <stop offset="0" stop-color="#E0B96A" stop-opacity=".34"/><stop offset="1" stop-color="#E0B96A" stop-opacity="0"/>
    </radialGradient>
    <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter>
  </defs>
  <rect width="512" height="512" fill="url(#sky)"/>
  <rect width="512" height="512" fill="url(#dawn)"/>
  <g fill="#fff">
    <circle cx="92" cy="96" r="3.4" opacity=".85"/><circle cx="412" cy="78" r="2.8" opacity=".7"/>
    <circle cx="352" cy="132" r="4" opacity=".8" fill="#CFE0FF"/><circle cx="150" cy="172" r="2.4" opacity=".5"/>
    <circle cx="440" cy="210" r="2.6" opacity=".5"/><circle cx="66" cy="252" r="2.4" opacity=".45"/>
    <circle cx="238" cy="70" r="2.2" opacity=".55"/>
  </g>
  <g transform="translate(256 276) scale(${scale}) translate(-256 -276)">
    <path filter="url(#glow)" fill="#F0A3AC" opacity=".55" d="M256 404s-118-74-148-143c-25-55 6-110 60-116 35-5 65 16 88 46 23-30 53-51 88-46 54 6 85 61 60 116-30 69-148 143-148 143z"/>
    <path fill="#F0A3AC" d="M256 404s-118-74-148-143c-25-55 6-110 60-116 35-5 65 16 88 46 23-30 53-51 88-46 54 6 85 61 60 116-30 69-148 143-148 143z"/>
    <path fill="#fff" opacity=".28" d="M170 172c-26 4-44 26-44 54 0 6 9 6 10 0 3-22 17-38 37-42 7-1 4-13-3-12z"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const shot = async (name, size, scale) => {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  await page.setContent(`<style>*{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg(scale)}`);
  await page.screenshot({ path: path.join(out, name), omitBackground: false });
  await page.close();
};
await shot("icon-512.png", 512, 1);
await shot("icon-192.png", 192, 1);
await shot("apple-touch-icon.png", 180, 0.92);
await shot("icon-maskable-512.png", 512, 0.72);
await browser.close();
console.log("icons written to", out);
