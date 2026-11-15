// 도트(픽셀) 아트 생성기 — 감 아이콘, 감나무 성장 단계

export const PALETTE: Record<string, string> = {
  O: "#F28C28", // 감
  D: "#D2601A", // 감 그림자
  H: "#FFC76B", // 감 하이라이트
  G: "#3E8E41", // 꼭지/잎
  g: "#2C6B30", // 잎 그림자
  L: "#6CC04A", // 잎 하이라이트
  l: "#9BDB6A", // 새싹 밝은 잎
  B: "#7A4A2A", // 줄기
  b: "#5A3420", // 줄기 그림자
  S: "#A86A3D", // 흙 밝음
  s: "#7E4E2B", // 흙
  K: "#3B2A1E", // 외곽선
  W: "#FFFFFF",
  C: "#DDEFFB", // 구름 그림자
};

export type Grid = string[][];

export const PERSIMMON = [
  "................",
  ".......bb.......",
  "....GGGbbGGG....",
  "...GGLGGGGLGG...",
  "..OOGGOOOOGGOO..",
  ".OOOOOOOOOOOOOO.",
  ".OHHOOOOOOOOOOD.",
  "OOHOOOOOOOOOOODD",
  "OOOOOOOOOOOOOODD",
  "OOOOOOOOOOOOODDD",
  ".OOOOOOOOOOOODD.",
  ".OOOOOOOOOODDDD.",
  "..OOOOOOOODDDD..",
  "...DDDDDDDDDD...",
  ".....DDDDDD.....",
  "................",
];

/** 문자 그리드 → 가로로 이어붙인 rect 목록 */
export function gridRects(rows: string[] | Grid) {
  const out: { x: number; y: number; w: number; c: string }[] = [];
  rows.forEach((row, y) => {
    const cells = typeof row === "string" ? row.split("") : row;
    let x = 0;
    while (x < cells.length) {
      const ch = cells[x];
      if (ch === "." || !PALETTE[ch]) { x++; continue; }
      let w = 1;
      while (x + w < cells.length && cells[x + w] === ch) w++;
      out.push({ x, y, w, c: PALETTE[ch] });
      x += w;
    }
  });
  return out;
}

export function gridSvg(rows: string[] | Grid, scale = 1) {
  const h = rows.length;
  const w = typeof rows[0] === "string" ? (rows[0] as string).length : (rows[0] as string[]).length;
  const rects = gridRects(rows)
    .map((r) => `<rect x="${r.x}" y="${r.y}" width="${r.w}" height="1" fill="${r.c}"/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges">${rects}</svg>`;
}

// ---------------------------------------------------------------------
// 감나무
// ---------------------------------------------------------------------
export const TREE_W = 40;
export const TREE_H = 44;
export const FULL_AT = 100; // 100개까지 나무가 자라고, 101개부터 감이 열림

export type Stage = { level: number; label: string };

export function stageOf(count: number): Stage {
  if (count <= 0) return { level: 0, label: "씨앗" };
  if (count < 20) return { level: 1, label: "새싹" };
  if (count < 45) return { level: 2, label: "떡잎" };
  if (count < 70) return { level: 3, label: "어린 나무" };
  if (count < FULL_AT) return { level: 4, label: "자라는 나무" };
  if (count === FULL_AT) return { level: 5, label: "풍성한 나무" };
  return { level: 6, label: "감나무" };
}

function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

function blank(): Grid {
  return Array.from({ length: TREE_H }, () => Array(TREE_W).fill("."));
}
function put(g: Grid, x: number, y: number, c: string) {
  if (x >= 0 && y >= 0 && x < TREE_W && y < TREE_H) g[y][x] = c;
}

function mound(g: Grid) {
  const base = TREE_H - 1;
  for (let x = 10; x < 30; x++) put(g, x, base, "s");
  for (let x = 12; x < 28; x++) put(g, x, base - 1, x < 18 ? "S" : "s");
  for (let x = 15; x < 25; x++) put(g, x, base - 2, x < 19 ? "S" : "s");
}

function trunk(g: Grid, topY: number, width: number) {
  const base = TREE_H - 3;
  const cx = TREE_W / 2;
  for (let y = topY; y <= base; y++) {
    const extra = y > base - 3 ? 1 : 0; // 뿌리 쪽 살짝 넓게
    const w = width + extra * 2;
    const x0 = Math.round(cx - w / 2);
    for (let x = x0; x < x0 + w; x++) put(g, x, y, x >= x0 + w - Math.max(1, Math.floor(w / 3)) ? "b" : "B");
  }
}

function branch(g: Grid, x0: number, y0: number, dx: number, len: number) {
  for (let i = 0; i < len; i++) put(g, x0 + dx * i, y0 - Math.floor(i / 2), "B");
}

function canopy(g: Grid, blobs: [number, number, number][], seed: number) {
  const r = rng(seed);
  const inside = (x: number, y: number) =>
    blobs.some(([cx, cy, rad]) => (x - cx) ** 2 + (y - cy) ** 2 <= rad * rad);
  const cxAll = blobs.reduce((a, b) => a + b[0], 0) / blobs.length;
  const cyAll = blobs.reduce((a, b) => a + b[1], 0) / blobs.length;
  for (let y = 0; y < TREE_H; y++) {
    for (let x = 0; x < TREE_W; x++) {
      if (!inside(x + 0.5, y + 0.5)) continue;
      const edgeBR = !inside(x + 2.5, y + 2.5);
      const edgeTL = !inside(x - 1.5, y - 1.5);
      let c = "G";
      if (edgeBR || (x - cxAll + (y - cyAll) > 6 && r() < 0.35)) c = "g";
      else if (edgeTL || (x - cxAll + (y - cyAll) < -8 && r() < 0.35)) c = "L";
      else if (r() < 0.08) c = r() < 0.5 ? "g" : "L";
      put(g, x, y, c);
    }
  }
}

const SPROUT_S = [
  ".LL...LL.",
  "LlGL.LGlL",
  ".LlGGGlL.",
  "..LGGGL..",
  "....G....",
  "....G....",
  "....g....",
];
const SPROUT_L = [
  "....LLL......",
  "...LlllL.....",
  "...LllGGL....",
  "....LGGGL.LL.",
  ".LL...GG.LllL",
  "LllL..G.LGllL",
  "LlGGL.GLGGLL.",
  ".LGGGGGGL....",
  "..LL..G......",
  "......G......",
  "......G......",
  "......g......",
];
function stamp(g: Grid, t: string[], base: number) {
  const x0 = Math.round(TREE_W / 2 - t[0].length / 2);
  const y0 = base - t.length + 1;
  t.forEach((row, y) => row.split("").forEach((c, x) => { if (c !== ".") put(g, x0 + x, y0 + y, c); }));
}

/** 감나무의 감 위치(감 하나 = 3x4 픽셀) */
export function persimmonSpots(blobs: [number, number, number][], seed: number) {
  const r = rng(seed * 7 + 3);
  const spots: [number, number][] = [];
  const inside = (x: number, y: number) =>
    blobs.some(([cx, cy, rad]) => (x - cx) ** 2 + (y - cy) ** 2 <= (rad - 1.5) ** 2);
  for (let tries = 0; tries < 4000 && spots.length < 48; tries++) {
    const x = Math.floor(r() * TREE_W);
    const y = Math.floor(r() * TREE_H);
    if (!inside(x + 1, y + 1) || !inside(x + 1, y + 3)) continue;
    if (spots.some(([sx, sy]) => Math.abs(sx - x) < 4 && Math.abs(sy - y) < 4)) continue;
    spots.push([x, y]);
  }
  return spots;
}

const FULL_BLOBS: [number, number, number][] = [
  [20, 15, 11], [11, 19, 8], [29, 19, 8], [15, 10, 7], [26, 10, 7], [20, 22, 9],
];

export function treeGrid(count: number, seed = 1): { grid: Grid; fruits: number; capacity: number } {
  const g = blank();
  const { level } = stageOf(count);
  mound(g);
  const base = TREE_H - 3;
  let fruits = 0;
  let capacity = 0;

  if (level === 0) {
    put(g, 19, base, "b"); put(g, 20, base, "B"); put(g, 20, base - 1, "B");
  } else if (level === 1) {
    stamp(g, SPROUT_S, base);
  } else if (level === 2) {
    stamp(g, SPROUT_L, base);
  } else if (level === 3) {
    trunk(g, base - 12, 2);
    canopy(g, [[20, base - 16, 6], [16, base - 13, 4], [24, base - 13, 4]], seed);
  } else if (level === 4) {
    trunk(g, base - 16, 3);
    branch(g, 19, base - 12, -1, 4);
    branch(g, 22, base - 13, 1, 4);
    canopy(g, [[20, base - 22, 8], [13, base - 18, 6], [27, base - 18, 6], [20, base - 16, 6]], seed);
  } else {
    trunk(g, 22, 4);
    branch(g, 18, 30, -1, 6);
    branch(g, 23, 29, 1, 6);
    canopy(g, FULL_BLOBS, seed);
    const spots = persimmonSpots(FULL_BLOBS, seed);
    capacity = spots.length;
    if (level === 6) {
      fruits = Math.min(count - FULL_AT, capacity);
      spots.slice(0, fruits).forEach(([x, y]) => {
        put(g, x + 1, y, "b");
        put(g, x, y + 1, "O"); put(g, x + 1, y + 1, "H"); put(g, x + 2, y + 1, "O");
        put(g, x, y + 2, "O"); put(g, x + 1, y + 2, "O"); put(g, x + 2, y + 2, "D");
        put(g, x + 1, y + 3, "D");
      });
    }
  }
  return { grid: g, fruits, capacity };
}
