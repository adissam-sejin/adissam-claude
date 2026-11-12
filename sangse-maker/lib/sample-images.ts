/** 랜딩 미리보기용 가짜 상품 사진 (SVG) */
function svg(bg: string, body: string, cap: string) {
  const s = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="800" viewBox="0 0 800 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${bg}"/><stop offset="1" stop-color="#ffffff"/></linearGradient>
  <linearGradient id="b" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="${body}"/><stop offset=".5" stop-color="#ffffff" stop-opacity=".55"/><stop offset="1" stop-color="${body}"/></linearGradient></defs>
  <rect width="800" height="800" fill="url(#g)"/>
  <ellipse cx="400" cy="690" rx="170" ry="26" fill="#000" opacity=".08"/>
  <rect x="290" y="250" width="220" height="440" rx="40" fill="url(#b)"/>
  <rect x="280" y="190" width="240" height="80" rx="24" fill="${cap}"/>
  <rect x="440" y="170" width="50" height="34" rx="10" fill="${cap}"/>
  </svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
}

export const SAMPLE_SETS: { images: string[] }[] = [
  { images: [svg("#dcebe5", "#2f6f5e", "#1f2a27"), svg("#eef3f1", "#3e8c76", "#22302c"), svg("#e5eeea", "#2f6f5e", "#c9d6d1")] },
  { images: [svg("#2a2622", "#c9a86a", "#141210"), svg("#3a332c", "#d8bd86", "#141210"), svg("#2a2622", "#b8955a", "#3a332c")] },
  { images: [svg("#ffe3d9", "#ff5a36", "#222"), svg("#fff0e9", "#ff7a59", "#222"), svg("#ffe3d9", "#ff5a36", "#ffd166")] },
];
