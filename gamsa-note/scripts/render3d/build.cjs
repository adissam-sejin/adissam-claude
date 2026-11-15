// 3D 에셋 · 아이콘 · OG 이미지 생성:  node scripts/render3d/build.cjs
const { chromium } = require('playwright');
const sharp = require('sharp');
const fs = require('fs');
const path = require('path');
const serve = require('./serve.cjs');

const ROOT = path.resolve(__dirname, '../..');
const PUB = path.join(ROOT, 'public');
const A3D = path.join(PUB, '3d');
fs.mkdirSync(A3D, { recursive: true });
fs.mkdirSync(path.join(PUB, 'icons'), { recursive: true });
const buf = (d) => Buffer.from(d.split(',')[1], 'base64');

(async () => {
  const srv = await serve(5182);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage();
  p.on('pageerror', (e) => console.log('ERR', e.message));
  await p.goto('http://localhost:5182/scripts/render3d/index.html');
  await p.waitForFunction(() => window.ready, null, { timeout: 60000 });

  // 감
  const per = buf(await p.evaluate(() => window.renderPersimmon(1024, 0, true)));
  const fruit = buf(await p.evaluate(() => window.renderPersimmon(256, 0, false)));
  await sharp(fruit).trim().resize(96).webp({ quality: 90 }).toFile(path.join(A3D, 'fruit.webp'));
  fs.writeFileSync(path.join(A3D, 'persimmon-1024.png'), per);
  await sharp(per).resize(256).webp({ quality: 90 }).toFile(path.join(A3D, 'persimmon.webp'));
  await sharp(per).resize(128).webp({ quality: 90 }).toFile(path.join(A3D, 'persimmon-sm.webp'));

  // 감나무 0~5 단계
  let spots = null;
  for (const st of [0, 1, 2, 3, 4, 5]) {
    const r = await p.evaluate((st) => window.renderTree(st, 800, 880, 0), st);
    await sharp(buf(r.png)).webp({ quality: 88 }).toFile(path.join(A3D, `tree-${st}.webp`));
    if (r.meta) spots = r.meta;
  }
  fs.writeFileSync(path.join(ROOT, 'src/lib/fruitSpots.json'), JSON.stringify(spots));
  console.log('fruit spots:', spots.length);

  // 감이 가득 열린 나무 (소개/OG용)
  const full = await p.evaluate(() => window.renderTree(5, 800, 880, 60));
  const fullPng = buf(full.png);
  await sharp(fullPng).webp({ quality: 88 }).toFile(path.join(A3D, 'tree-fruits.webp'));
  const sprout = buf((await p.evaluate(() => window.renderTree(2, 800, 880, 0))).png);
  const young = buf((await p.evaluate(() => window.renderTree(4, 800, 880, 0))).png);

  // ---------- 앱 아이콘 ----------
  const iconBg = (size, radius) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
    <defs><radialGradient id="g" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#FFF6E6"/><stop offset="1" stop-color="#FFD9A8"/></radialGradient></defs>
    <rect width="${size}" height="${size}" rx="${radius}" fill="url(#g)"/></svg>`);
  const icon = async (size, { radius = 0, scale = 0.78, file }) => {
    const art = await sharp(per).trim().resize(Math.round(size * scale), Math.round(size * scale), { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer();
    const meta = await sharp(art).metadata();
    await sharp(iconBg(size, radius))
      .composite([{ input: art, left: Math.round((size - meta.width) / 2), top: Math.round((size - meta.height) / 2 + size * 0.02) }])
      .png().toFile(path.join(PUB, file));
  };
  await icon(180, { file: 'icons/apple-touch-icon.png' });
  await icon(192, { radius: 42, file: 'icons/icon-192.png' });
  await icon(512, { radius: 112, file: 'icons/icon-512.png' });
  await icon(512, { scale: 0.6, file: 'icons/maskable-512.png' });

  // 파비콘 (배경 없이 감만)
  const fav = async (s) => sharp(per).trim().resize(s, s, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
  const favs = await Promise.all([16, 32, 48].map(fav));
  fs.writeFileSync(path.join(PUB, 'icons/favicon-32.png'), favs[1]);
  fs.writeFileSync(path.join(PUB, 'icons/favicon-16.png'), favs[0]);
  fs.writeFileSync(path.join(PUB, 'icons/favicon-48.png'), favs[2]);
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
  fs.writeFileSync(path.join(PUB, 'favicon.ico'), Buffer.concat([header, ...favs]));
  const svgIcon = (await sharp(per).trim().resize(128).png().toBuffer()).toString('base64');
  fs.writeFileSync(path.join(PUB, 'icons/icon.svg'), `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 128 128"><image width="128" height="128" href="data:image/png;base64,${svgIcon}"/></svg>`);

  // ---------- 오픈그래프 1200x630 ----------
  const d = (x) => 'data:image/png;base64,' + x.toString('base64');
  const og = await b.newPage({ viewport: { width: 1200, height: 630 } });
  await og.setContent(`<!doctype html><html><head><meta charset="utf-8">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css">
  <style>
  html,body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Pretendard,sans-serif}
  body{background:radial-gradient(170% 80% at 50% 128%,#a9d97a 0 50%,transparent 50.4%),linear-gradient(180deg,#6fb8f2 0%,#a8d8ff 55%,#d7f0ff 100%);position:relative}
  .sun{display:none}
  .cloud{position:absolute;background:#fff;border-radius:999px;filter:drop-shadow(0 8px 10px #8fc6e855)}
  .t{position:absolute}
  .card{position:absolute;left:60px;top:150px;width:680px}
  .card h1, .card p{color:#fff;text-shadow:0 3px 12px #2a6aa055}
  .chip{color:#2d4a2b !important}
  h1{margin:0;font-size:104px;font-weight:800;display:flex;align-items:center;gap:18px;letter-spacing:-3px}
  h1 img{width:120px;height:120px;filter:drop-shadow(0 10px 12px #0002)}
  p{margin:14px 0 0;font-size:38px;font-weight:600}
  .chip{display:inline-block;white-space:nowrap;margin-top:30px;font-size:26px;font-weight:600;background:rgba(255,255,255,.75);padding:14px 28px;border-radius:999px;border:2px solid #fff}
  </style></head><body>
  <div class="sun"></div>
  <div class="cloud" style="left:90px;top:50px;width:180px;height:56px"></div>
  <div class="cloud" style="left:560px;top:80px;width:130px;height:42px"></div>
  <img class="t" src="${d(young)}" style="left:600px;top:300px;width:250px">
  <img class="t" src="${d(fullPng)}" style="left:770px;top:40px;width:520px">
  <div class="card"><h1><img src="${d(per)}">감사노트</h1>
  <p>감사한 만큼 감이 열리는 감 농장</p>
  <div class="chip">매일 감사 한 줄 · 사진 한 장 · 함께 키우는 감나무</div></div>
  </body></html>`);
  await og.waitForTimeout(500);
  await og.evaluate(() => document.fonts.ready);
  await og.screenshot({ path: path.join(PUB, 'og-image.png') });

  await b.close(); srv.close();
  console.log('done');
})();
