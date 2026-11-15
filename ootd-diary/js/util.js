// 공통 상수와 도우미

export const CATEGORIES = [
  { id: 'top', ko: '상의' },
  { id: 'bottom', ko: '하의' },
  { id: 'outer', ko: '아우터' },
  { id: 'dress', ko: '원피스' },
  { id: 'shoes', ko: '신발' },
  { id: 'bag', ko: '가방' },
  { id: 'acc', ko: '액세서리' },
];
export const catKo = (id) => (CATEGORIES.find((c) => c.id === id) || {}).ko || '기타';

export const SEASONS = ['봄', '여름', '가을', '겨울'];

export const WARMTH = [
  { v: 1, ko: '아주 얇음', hint: '한여름' },
  { v: 2, ko: '얇음', hint: '늦봄·초가을' },
  { v: 3, ko: '보통', hint: '봄·가을' },
  { v: 4, ko: '도톰', hint: '늦가을·초겨울' },
  { v: 5, ko: '아주 두꺼움', hint: '한겨울' },
];

export const COLORS = [
  { id: 'black', ko: '블랙', hex: '#1d1d1f', neutral: true },
  { id: 'white', ko: '화이트', hex: '#f7f5f0', neutral: true },
  { id: 'gray', ko: '그레이', hex: '#9b9b9b', neutral: true },
  { id: 'navy', ko: '네이비', hex: '#232f4b', neutral: true },
  { id: 'beige', ko: '베이지', hex: '#d9c7a8', neutral: true },
  { id: 'brown', ko: '브라운', hex: '#7a5236', neutral: true },
  { id: 'khaki', ko: '카키', hex: '#6f6f4a', neutral: true },
  { id: 'denim', ko: '데님', hex: '#5b7fa6', neutral: true },
  { id: 'blue', ko: '블루', hex: '#2f6fde' },
  { id: 'green', ko: '그린', hex: '#3d8b5a' },
  { id: 'yellow', ko: '옐로', hex: '#f2c744' },
  { id: 'orange', ko: '오렌지', hex: '#ee8434' },
  { id: 'red', ko: '레드', hex: '#d43b3b' },
  { id: 'pink', ko: '핑크', hex: '#f2a0b5' },
  { id: 'purple', ko: '퍼플', hex: '#8a63c9' },
  { id: 'multi', ko: '패턴', hex: '#c9b8a0' },
];
export const colorOf = (id) => COLORS.find((c) => c.id === id) || COLORS[2];

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const pad = (n) => String(n).padStart(2, '0');
export const ymd = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const fromYmd = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
export const daysBetween = (a, b) => Math.round((fromYmd(b) - fromYmd(a)) / 86400000);
const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
export const koDate = (s) => { const d = fromYmd(s); return `${d.getMonth() + 1}월 ${d.getDate()}일 ${WEEK[d.getDay()]}요일`; };
export const won = (n) => (n || n === 0 ? `${Number(n).toLocaleString('ko-KR')}원` : '');

export function seasonOfMonth(m) { // m: 1~12
  if (m >= 3 && m <= 5) return '봄';
  if (m >= 6 && m <= 8) return '여름';
  if (m >= 9 && m <= 11) return '가을';
  return '겨울';
}

// 사진이 없을 때 보여줄 카테고리 실루엣
const GLYPH = {
  top: '<path d="M35 18 20 26 8 44l14 10 6-8v40h44V46l6 8 14-10-12-18-15-8q-15 12-30 0Z"/>',
  bottom: '<path d="M30 12h40l6 78H56l-6-50-6 50H24Z"/>',
  outer: '<path d="M36 12 20 22 8 60l12 6 6-18v44h48V48l6 18 12-6-12-38-16-10-14 18Z"/><path d="M50 30v62" fill="none" stroke="rgba(128,128,128,.55)" stroke-width="1.5"/>',
  dress: '<path d="m40 10 6 12h8l6-12 6 4-6 24 20 52H20l20-52-6-24Z"/>',
  shoes: '<path d="M10 62q0-14 12-16h18l12 10 28 6q12 2 12 12v4H10Z"/>',
  bag: '<path d="M26 40h48l6 48H20Z"/><path d="M38 40q0-22 12-22t12 22" fill="none" stroke="currentColor" stroke-width="4"/>',
  acc: '<path d="M18 62q0-32 32-32 28 0 30 28l14 8q-24 4-76-4Z"/>',
};

export function glyph(cat, colorId) {
  const c = colorOf(colorId);
  const fill = c.id === 'multi' ? 'url(#mp)' : c.hex;
  const defs = c.id === 'multi'
    ? '<defs><pattern id="mp" width="10" height="10" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="10" height="10" fill="#e9dcc6"/><rect width="5" height="10" fill="#b5553c"/></pattern></defs>'
    : '';
  return `<svg class="glyph" viewBox="0 0 100 100" aria-hidden="true" style="color:${c.hex}">${defs}<g fill="${fill}" stroke="rgba(128,128,128,.45)" stroke-width="1">${GLYPH[cat] || GLYPH.top}</g></svg>`;
}

// 아이템 썸네일 (사진이 있으면 사진, 없으면 실루엣)
export function tile(item, { full = false } = {}) {
  if (!item) return '<div class="tile tile-missing"></div>';
  const src = full ? (item.img || item.thumb) : (item.thumb || item.img);
  const inner = src
    ? `<img src="${esc(src)}" alt="${esc(item.name)}" loading="lazy" data-cat="${esc(item.category)}" data-color="${esc(item.color)}">`
    : glyph(item.category, item.color);
  return `<div class="tile">${inner}</div>`;
}

// 사진 파일 → 리사이즈된 JPEG dataURL (원본 + 썸네일) + 대표 색 추정
export async function processPhoto(file, { max = 900, thumbMax = 260 } = {}) {
  let bmp;
  try {
    bmp = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    bmp = await new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('이미지를 읽을 수 없어요'));
      img.src = URL.createObjectURL(file);
    });
  }
  const draw = (limit, q) => {
    const scale = Math.min(1, limit / Math.max(bmp.width, bmp.height));
    const w = Math.max(1, Math.round(bmp.width * scale));
    const h = Math.max(1, Math.round(bmp.height * scale));
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    return { cv, url: cv.toDataURL('image/jpeg', q) };
  };
  const big = draw(max, 0.82);
  const small = draw(thumbMax, 0.8);
  return { img: big.url, thumb: small.url, color: dominantColor(small.cv) };
}

// 사진 가운데 영역의 평균색으로 색상 칩을 추정
function dominantColor(cv) {
  try {
    const w = cv.width, h = cv.height;
    const ctx = cv.getContext('2d');
    const x0 = Math.floor(w * 0.25), y0 = Math.floor(h * 0.25);
    const data = ctx.getImageData(x0, y0, Math.max(1, Math.floor(w * 0.5)), Math.max(1, Math.floor(h * 0.5))).data;
    let r = 0, g = 0, b = 0, n = 0, rAll = 0, gAll = 0, bAll = 0, nAll = 0;
    for (let i = 0; i < data.length; i += 16) {
      const R = data[i], G = data[i + 1], B = data[i + 2];
      rAll += R; gAll += G; bAll += B; nAll++;
      if (R > 232 && G > 232 && B > 232) continue; // 흰 배경은 제외
      r += R; g += G; b += B; n++;
    }
    if (n < nAll * 0.15) { r = rAll; g = gAll; b = bAll; n = nAll; }
    return nearestColor(r / n, g / n, b / n);
  } catch { return null; }
}

function nearestColor(r, g, b) {
  const mx = Math.max(r, g, b) / 255, mn = Math.min(r, g, b) / 255;
  const l = (mx + mn) / 2;
  const d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d !== 0) {
    const R = r / 255, G = g / 255, B = b / 255;
    if (mx === R) h = ((G - B) / d) % 6; else if (mx === G) h = (B - R) / d + 2; else h = (R - G) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  if (l < 0.16) return 'black';
  if (s < 0.12) return l > 0.82 ? 'white' : 'gray';
  if (h >= 200 && h < 255) {
    if (l < 0.3) return 'navy';
    return s < 0.45 ? 'denim' : 'blue';
  }
  if (h >= 15 && h < 55) {
    if (s < 0.5 && l > 0.6) return 'beige';
    if (l < 0.42) return 'brown';
    return h < 35 ? 'orange' : 'yellow';
  }
  if (h >= 55 && h < 95) return s < 0.45 && l < 0.5 ? 'khaki' : (h < 70 ? 'yellow' : 'green');
  if (h >= 95 && h < 200) return 'green';
  if (h >= 255 && h < 300) return 'purple';
  if (h >= 300 && h < 345) return 'pink';
  return l > 0.7 ? 'pink' : 'red';
}

export function download(filename, text, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
