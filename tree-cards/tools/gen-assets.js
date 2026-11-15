// 아이콘·오픈그래프 이미지 생성기 (포스터 스타일: 어두운 배경 + 아래로 스며드는 도형 + 입자감)
const { chromium } = require('playwright'); const fs = require('fs');
const OUT = require('path').join(__dirname, '..', 'assets') + '/';
const T = {
  christmas: { bg: ['#16241c', '#0a100b'], a: ['#1f9149', '#0f5c2d'], b: ['#8f241a', '#5a130d'], label: '크리스마스 트리', line: '따뜻한 인사를 트리에 달아주세요', accent: '#f2c230' },
  persimmon: { bg: ['#261809', '#120c07'], a: ['#6f7f2c', '#3f4d17'], b: ['#a1541b', '#6a2f0c'], label: '감사 감나무', line: '감사한 마음을 적으면 감이 열려요', accent: '#ff8f2e' },
  cherry:    { bg: ['#2a1420', '#130a10'], a: ['#d0668c', '#8f3558'], b: ['#7d3157', '#4f1a37'], label: '벚꽃나무', line: '소감을 남기면 벚꽃이 피어나요', accent: '#ffc2d4' },
};
const fade = (id, c, end) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset=".55" stop-color="${c[1]}" stop-opacity=".92"/><stop offset="1" stop-color="${c[1]}" stop-opacity="${end}"/></linearGradient>`;
// 1000x1000 좌표계의 나무 그림
function art(theme) {
  const c = T[theme]; let s = `<defs>${fade('a', c.a, theme === 'christmas' ? 0 : .2)}${fade('b', c.b, theme === 'christmas' ? 0 : .2)}</defs>`;
  if (theme === 'christmas') {
    const tiers = [[150, 470, 250], [300, 660, 345], [470, 900, 440]];
    tiers.forEach(([ay, by, hw], i) => { const h = by - ay, cx = hw * .36, cy = ay + h * .7;
      s += `<path d="M500 ${ay} Q${500 + cx} ${cy} ${500 + hw} ${by} L${500 - hw} ${by} Q${500 - cx} ${cy} 500 ${ay} Z" fill="url(#${i % 2 ? 'b' : 'a'})"/>`; });
    const y = 108, k = 9, z = 46;
    s += `<path d="M500 ${y - z} Q${500 + k} ${y - k} ${500 + z} ${y} Q${500 + k} ${y + k} 500 ${y + z} Q${500 - k} ${y + k} ${500 - z} ${y} Q${500 - k} ${y - k} 500 ${y - z} Z" fill="#f6e7b8"/>`;
    [[452, 350, '#f2c230'], [575, 500, '#f6f1e6'], [400, 580, '#e5383b'], [560, 690, '#f2c230'], [330, 740, '#f6f1e6'], [680, 760, '#e5383b']].forEach(([x, yy, f]) => s += `<circle cx="${x}" cy="${yy}" r="46" fill="${f}"/>`);
  } else {
    s += `<path d="M482 600 C488 720 480 840 466 960 L534 960 C520 840 512 720 518 600 Z" fill="${theme === 'persimmon' ? '#6b4a2f' : '#6a4552'}"/>`;
    [[500, 290, 215, 'a'], [300, 430, 195, 'b'], [700, 430, 195, 'b'], [500, 500, 230, 'a'], [360, 640, 180, 'b'], [640, 640, 180, 'b']].forEach(([x, y, r, g]) => s += `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#${g})"/>`);
    const spots = [[430, 300], [610, 380], [300, 470], [500, 520], [690, 560], [380, 650]];
    if (theme === 'persimmon') spots.forEach(([x, y], i) => { s += `<ellipse cx="${x}" cy="${y + 3}" rx="56" ry="51" fill="${['#ff8f2e', '#f9761a', '#ffa64d'][i % 3]}"/><g transform="translate(${x} ${y - 47})" fill="#3f5a1c">` + [45, 135, 225, 315].map(a => `<ellipse rx="15" ry="6" cx="11" transform="rotate(${a})"/>`).join('') + `</g>`; });
    else spots.forEach(([x, y], i) => { const f = ['#ffd9e4', '#fff0f4', '#ffc2d4'][i % 3]; s += `<g transform="translate(${x} ${y}) rotate(${i * 23})" fill="${f}">` + [0, 72, 144, 216, 288].map(a => `<circle cy="-32" r="29" transform="rotate(${a})"/>`).join('') + `<circle r="34"/></g>`; });
  }
  return s;
}
const grain = (f = .8, o = .5) => `<filter id="n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${f}" numOctaves="2" stitchTiles="stitch"/><feColorMatrix type="saturate" values="0"/><feComponentTransfer><feFuncR type="linear" slope="3" intercept="-1"/><feFuncG type="linear" slope="3" intercept="-1"/><feFuncB type="linear" slope="3" intercept="-1"/><feFuncA type="linear" slope="0" intercept="1"/></feComponentTransfer></filter><rect width="100%" height="100%" filter="url(#n)" opacity="${o}" style="mix-blend-mode:overlay"/>`;
const bg = (c, w, h) => `<defs><radialGradient id="bg" cx="50%" cy="0%" r="110%"><stop offset="0" stop-color="${c.bg[0]}"/><stop offset=".7" stop-color="${c.bg[1]}"/></radialGradient></defs><rect width="${w}" height="${h}" fill="url(#bg)"/>`;
// 아이콘: 가장자리가 잘려도(마스크) 그림이 남도록 안쪽 70% 에 그린다
const icon = (theme, size, withGrain) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1000 1000">${bg(T[theme], 1000, 1000)}<g transform="translate(75 62) scale(.85)">${art(theme)}</g>${withGrain ? grain(.02 * 40, .45) : ''}</svg>`;
const og = (theme) => { const c = T[theme]; return `<!doctype html><html><head><meta charset="utf-8"><link href="https://fonts.googleapis.com/css2?family=Gothic+A1:wght@400;500;700&display=swap" rel="stylesheet"><style>
*{margin:0;box-sizing:border-box}body{width:1200px;height:630px;position:relative;overflow:hidden;font-family:"Gothic A1",sans-serif;color:#f3eee3;background:radial-gradient(120% 90% at 30% 0%,${c.bg[0]},${c.bg[1]} 70%)}
svg.t{position:absolute;left:40px;top:15px;width:600px;height:600px}
.x{position:absolute;left:660px;right:70px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center}
.k{font-size:24px;letter-spacing:.34em;color:${c.accent};margin-bottom:22px}
h1{font-size:92px;font-weight:500;letter-spacing:-.03em;line-height:1.1}
p{margin-top:26px;font-size:31px;line-height:1.5;color:#cfc8ba;word-break:keep-all}
svg.g{position:absolute;inset:0;width:100%;height:100%}</style></head><body>
<svg class="t" viewBox="0 0 1000 1000">${art(theme)}</svg>
<div class="x"><div class="k">${c.label}</div><h1>메시지 나무</h1><p>${c.line}</p></div>
<svg class="g">${grain(.62, .5)}</svg></body></html>`; };
(async () => { const br = await chromium.launch();
  for (const theme of Object.keys(T)) {
    fs.writeFileSync(`${OUT}favicon-${theme}.svg`, icon(theme, 64, false));
    for (const size of [180, 192, 512]) { const p = await br.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 }); await p.setContent(`<body style="margin:0">${icon(theme, size, false)}</body>`); await p.screenshot({ path: `${OUT}icon-${theme}-${size}.png` }); await p.close(); }
    const p = await br.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 }); await p.setContent(og(theme), { waitUntil: 'networkidle' }); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(300);
    console.log(theme, 'font loaded:', await p.evaluate(() => document.fonts.check('500 92px "Gothic A1"')));
    await p.screenshot({ path: `${OUT}og-${theme}.jpg`, type: "jpeg", quality: 86 }); await p.close();
  }
  await br.close(); })();
