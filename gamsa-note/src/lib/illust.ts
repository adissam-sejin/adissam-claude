// 플랫 2D 일러스트 (SVG 문자열) — 앱 컴포넌트와 아이콘 생성 스크립트가 함께 사용
import { FULL_AT, stageOf } from "./growth";

const C = {
  persimmon: "#FF8A3D",
  persimmonDark: "#F06A1E",
  leaf: "#7BC66B",
  leafDark: "#5DAA52",
  leafLight: "#A3DE8C",
  calyx: "#5AA64E",
  stem: "#8B5A3C",
  trunk: "#B07A4F",
  trunkDark: "#946140",
  soil: "#D9935F",
  soilLight: "#E6AC7A",
  ground: "#F2E2C9",
  ink: "#2B2118",
  blush: "#FF9C9C",
  mouth: "#F0607A",
};


/** 귀여운 얼굴: (cx, cy) 중심, s 크기 */
export function face(cx: number, cy: number, s: number) {
  const e = (dx: number) => `
    <ellipse cx="${cx + dx}" cy="${cy}" rx="${0.1 * s}" ry="${0.13 * s}" fill="${C.ink}"/>
    <circle cx="${cx + dx + 0.035 * s}" cy="${cy - 0.05 * s}" r="${0.038 * s}" fill="#fff"/>`;
  const b = (dx: number) => `<ellipse cx="${cx + dx}" cy="${cy + 0.2 * s}" rx="${0.14 * s}" ry="${0.08 * s}" fill="${C.blush}" opacity=".75"/>`;
  return `<g>
    ${b(-0.56 * s)}${b(0.56 * s)}
    ${e(-0.33 * s)}${e(0.33 * s)}
    <path d="M${cx - 0.13 * s} ${cy + 0.13 * s} Q${cx} ${cy + 0.4 * s} ${cx + 0.13 * s} ${cy + 0.13 * s} Z" fill="${C.mouth}" stroke="${C.ink}" stroke-width="${0.035 * s}" stroke-linejoin="round"/>
  </g>`;
}

/** 감 (viewBox 0 0 100 100) */
export function persimmonSvg(opts: { face?: boolean } = {}) {
  const clip = "gam-pc";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
    <defs><clipPath id="${clip}"><ellipse cx="50" cy="58" rx="41" ry="35"/></clipPath></defs>
    <ellipse cx="50" cy="58" rx="41" ry="35" fill="${C.persimmon}"/>
    <g clip-path="url(#${clip})"><ellipse cx="60" cy="68" rx="40" ry="30" fill="${C.persimmonDark}" opacity=".45"/></g>
    <ellipse cx="29" cy="44" rx="9" ry="5" fill="#fff" opacity=".55" transform="rotate(-28 29 44)"/>
    <path d="M50 19 Q57 27 72 25 Q62 31 64 40 Q55 33 50 37 Q45 33 36 40 Q38 31 28 25 Q43 27 50 19Z" fill="${C.calyx}" stroke="${C.calyx}" stroke-width="2" stroke-linejoin="round"/>
    <rect x="47" y="9" width="6" height="14" rx="3" fill="${C.stem}"/>
    ${opts.face ? face(50, 60, 46) : ""}
  </svg>`;
}

function miniFruit(x: number, y: number, r = 7) {
  return `<g>
    <circle cx="${x}" cy="${y}" r="${r}" fill="${C.persimmon}"/>
    <path d="M${x + r * 0.95} ${y + r * 0.1} A${r} ${r} 0 0 1 ${x - r * 0.4} ${y + r * 0.92} A${r * 1.1} ${r * 0.9} 0 0 0 ${x + r * 0.95} ${y + r * 0.1}Z" fill="${C.persimmonDark}" opacity=".6"/>
    <circle cx="${x - r * 0.38}" cy="${y - r * 0.35}" r="${r * 0.22}" fill="#fff" opacity=".6"/>
    <path d="M${x - r * 0.55} ${y - r * 0.75} Q${x} ${y - r * 0.35} ${x + r * 0.55} ${y - r * 0.75} Q${x} ${y - r * 1.2} ${x - r * 0.55} ${y - r * 0.75}Z" fill="${C.calyx}"/>
  </g>`;
}

type Blob = [number, number, number];

function canopy(blobs: Blob[]) {
  const shadow = blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y + 5}" r="${r}" fill="${C.leafDark}"/>`).join("");
  const main = blobs.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${C.leaf}"/>`).join("");
  const hl = blobs
    .filter((_, i) => i % 2 === 0)
    .map(([x, y, r]) => `<ellipse cx="${x - r * 0.38}" cy="${y - r * 0.42}" rx="${r * 0.3}" ry="${r * 0.18}" fill="${C.leafLight}" transform="rotate(-25 ${x - r * 0.38} ${y - r * 0.42})"/>`)
    .join("");
  return shadow + main + hl;
}

function trunk(top: number, w: number) {
  const b = 204;
  return `<path d="M${100 - w * 0.75} ${b} Q${100 - w * 0.5} ${(b + top) / 2} ${100 - w * 0.4} ${top} L${100 + w * 0.4} ${top} Q${100 + w * 0.5} ${(b + top) / 2} ${100 + w * 0.75} ${b} Z" fill="${C.trunk}"/>
    <path d="M${100 + w * 0.1} ${b} Q${100 + w * 0.25} ${(b + top) / 2} ${100 + w * 0.2} ${top} L${100 + w * 0.4} ${top} Q${100 + w * 0.5} ${(b + top) / 2} ${100 + w * 0.75} ${b} Z" fill="${C.trunkDark}"/>`;
}

function leafShape(x: number, y: number, len: number, angle: number) {
  return `<g transform="rotate(${angle} ${x} ${y})">
    <path d="M${x} ${y} Q${x + len * 0.5} ${y - len * 0.42} ${x + len} ${y} Q${x + len * 0.5} ${y + len * 0.3} ${x} ${y}Z" fill="${C.leaf}"/>
    <path d="M${x + len * 0.1} ${y} Q${x + len * 0.5} ${y - len * 0.08} ${x + len * 0.85} ${y}" stroke="${C.leafDark}" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  </g>`;
}

const STAGE_BLOBS: Record<number, Blob[]> = {
  3: [[100, 98, 36], [72, 112, 24], [128, 112, 24], [100, 70, 26]],
  4: [[100, 84, 46], [60, 102, 30], [140, 102, 30], [78, 58, 30], [122, 58, 30], [100, 116, 30]],
  5: [[100, 80, 52], [50, 100, 36], [150, 100, 36], [68, 50, 34], [132, 50, 34], [100, 34, 30], [100, 118, 36], [30, 84, 22], [170, 84, 22]],
};
const FACE: Record<number, [number, number, number]> = { 3: [100, 100, 40], 4: [100, 94, 48], 5: [100, 92, 54] };

/** 감나무 5단계에서 감이 열릴 자리 (얼굴 피해서) */
export const FRUIT_SPOTS: [number, number][] = (() => {
  const blobs = STAGE_BLOBS[5];
  const [fx, fy] = FACE[5];
  const out: [number, number][] = [];
  let s = 11;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  for (let t = 0; t < 5000 && out.length < 44; t++) {
    const x = 14 + rnd() * 172, y = 6 + rnd() * 150;
    if (!blobs.some(([bx, by, r]) => (x - bx) ** 2 + (y - by) ** 2 < (r - 6) ** 2)) continue;
    if (Math.abs(x - fx) < 44 && y > fy - 28 && y < fy + 36) continue;
    if (out.some(([ox, oy]) => (ox - x) ** 2 + (oy - y) ** 2 < 15 ** 2)) continue;
    out.push([Math.round(x), Math.round(y)]);
  }
  return out;
})();

/** 감나무 (viewBox 0 0 200 220) */
export function treeSvg(count: number) {
  const st = stageOf(count);
  const lvl = Math.min(st.level, 5);
  let body = `<ellipse cx="100" cy="206" rx="86" ry="12" fill="${C.ground}"/>`;
  if (lvl <= 2) {
    body += `<path d="M44 208 Q48 140 100 138 Q152 140 156 208 Z" fill="${C.soil}"/>
      <path d="M62 170 Q74 146 100 144" stroke="${C.soilLight}" stroke-width="7" fill="none" stroke-linecap="round"/>`;
    if (lvl === 0) {
      body += `<ellipse cx="104" cy="134" rx="9" ry="6.5" fill="${C.stem}" transform="rotate(-25 104 134)"/>
        <ellipse cx="101" cy="131" rx="2.5" ry="1.6" fill="#fff" opacity=".45"/>`;
    } else if (lvl === 1) {
      body += `<path d="M100 142 Q98 125 101 108" stroke="${C.leafDark}" stroke-width="5" fill="none" stroke-linecap="round"/>
        ${leafShape(101, 110, 30, -150)}${leafShape(101, 110, 30, -30)}`;
    } else {
      body += `<path d="M100 142 Q96 110 102 72" stroke="${C.leafDark}" stroke-width="6" fill="none" stroke-linecap="round"/>
        ${leafShape(99, 122, 30, 200)}${leafShape(99, 112, 30, -20)}${leafShape(101, 92, 28, 195)}${leafShape(102, 76, 30, -150)}${leafShape(102, 76, 30, -30)}`;
    }
    body += face(100, 172, 50);
  } else {
    body += `<path d="M66 208 Q100 186 134 208 Z" fill="${C.soil}"/>`;
    const top = { 3: 118, 4: 110, 5: 104 }[lvl]!;
    const w = { 3: 12, 4: 18, 5: 26 }[lvl]!;
    body += trunk(top, w);
    if (lvl >= 4) {
      body += `<path d="M100 150 Q118 132 130 112" stroke="${C.trunk}" stroke-width="${w * 0.38}" fill="none" stroke-linecap="round"/>
        <path d="M100 145 Q82 130 70 112" stroke="${C.trunk}" stroke-width="${w * 0.38}" fill="none" stroke-linecap="round"/>`;
    }
    body += canopy(STAGE_BLOBS[lvl]);
    const [fx, fy, fs] = FACE[lvl];
    body += face(fx, fy, fs);
    if (count > FULL_AT) {
      body += FRUIT_SPOTS.slice(0, count - FULL_AT).map(([x, y]) => miniFruit(x, y)).join("");
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 220">${body}</svg>`;
}

export function fruitsOf(count: number) {
  const grown = Math.max(0, count - FULL_AT);
  return { grown, shown: Math.min(grown, FRUIT_SPOTS.length) };
}
