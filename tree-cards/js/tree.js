/* 나무 그리기 + 카드(오너먼트/감/벚꽃) 배치 */
(function () {
  const NS = "http://www.w3.org/2000/svg";
  const VB_W = 1000, VB_H = 1150;

  const THEMES = {
    christmas: {
      label: "크리스마스 트리", emoji: "🎄", item: "오너먼트",
      tagline: "따뜻한 크리스마스 인사를 트리에 달아주세요",
      writeBtn: "카드 달기", writeTitle: "크리스마스 카드 쓰기",
      placeholder: "메리 크리스마스! 전하고 싶은 마음을 적어주세요.",
      empty: "아직 달린 카드가 없어요. 첫 번째 오너먼트를 달아주세요!",
      unit: "개의 카드", listTitle: "트리에 달린 카드",
    },
    persimmon: {
      label: "감사 감나무", emoji: "🍊", item: "감",
      tagline: "감사한 마음을 적으면 감이 주렁주렁 열려요",
      writeBtn: "감사 남기기", writeTitle: "감사한 마음 적기",
      placeholder: "고마웠던 일, 감사한 사람을 떠올리며 적어주세요.",
      empty: "아직 열린 감이 없어요. 첫 번째 감사를 남겨주세요!",
      unit: "개의 감사", listTitle: "나무에 열린 감사",
    },
    cherry: {
      label: "벚꽃나무", emoji: "🌸", item: "벚꽃",
      tagline: "소감과 리뷰를 남기면 벚꽃이 피어나요",
      writeBtn: "소감 남기기", writeTitle: "소감·리뷰 남기기",
      placeholder: "어떠셨나요? 소감이나 리뷰를 자유롭게 남겨주세요.",
      empty: "아직 핀 꽃이 없어요. 첫 번째 소감을 남겨주세요!",
      unit: "개의 소감", listTitle: "나무에 핀 소감",
    },
  };

  /* ---------- 나무 모양 정의 ---------- */
  // 크리스마스 트리: 옆선이 안쪽으로 휘어 내려오는 단 [꼭짓점 y, 밑변 y, 밑변 반폭]
  const TIERS = [
    [80, 350, 260],
    [200, 520, 340],
    [330, 700, 410],
    [470, 890, 465],
    [610, 1090, 492],
  ];
  // 옆선 곡선의 조절점 (반폭 비율, 높이 비율)
  const KX = 0.36, KY = 0.7;
  // 감나무·벚꽃나무: 겹쳐지는 원 [cx, cy, r]
  const BLOBS = [
    [500, 240, 200], [310, 375, 185], [690, 375, 185], [500, 435, 215],
    [215, 565, 150], [785, 565, 150], [395, 615, 180], [605, 615, 180],
  ];

  function tierHalfWidth(tier, y) {
    const [ay, by, hw] = tier;
    const u = (y - ay) / (by - ay);
    if (u < 0 || u > 0.93) return -1; // 아래쪽은 흐려지는 구간이라 비워 둔다
    const A = 1 - 2 * KY, B = 2 * KY;
    const t = (-B + Math.sqrt(B * B + 4 * A * u)) / (2 * A);
    return hw * (2 * KX * t * (1 - t) + t * t);
  }

  function insidePoint(theme, x, y) {
    if (theme === "christmas") {
      for (const tier of TIERS) {
        if (Math.abs(x - 500) <= tierHalfWidth(tier, y)) return true;
      }
      return false;
    }
    for (const [cx, cy, r] of BLOBS) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) return true;
    }
    return false;
  }
  function fits(theme, x, y, R) {
    const m = R * (theme === "christmas" ? 0.5 : 0.8);
    return insidePoint(theme, x, y) && insidePoint(theme, x - m, y) && insidePoint(theme, x + m, y) &&
      insidePoint(theme, x, y - m) && insidePoint(theme, x, y + m);
  }

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  // 반지름 R짜리 카드가 들어갈 수 있는 자리 목록 (항상 같은 순서로 나옴)
  function slots(theme, R) {
    const rand = rng(theme.length * 7919 + Math.round(R * 10));
    const dx = R * 2.2, dy = dx * 0.9;
    const pts = [];
    let row = 0;
    for (let y = 60; y < 1040; y += dy, row++) {
      // 가운데(x=500)를 기준으로 좌우 대칭이 되게 놓는다
      for (let x = 500 - Math.floor(500 / dx) * dx + (row % 2 ? dx / 2 : 0); x < VB_W; x += dx) {
        const px = x + (rand() - 0.5) * R * 0.3, py = y + (rand() - 0.5) * R * 0.3;
        if (fits(theme, px, py, R)) pts.push([px, py]);
      }
    }
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    return pts;
  }

  // 카드 수에 맞춰 크기를 정하고, 너무 많으면 나무를 확대(zoom)한다
  function layout(theme, n, stagePx) {
    const pxPerUnit = stagePx / VB_W;
    const minR = Math.max(30, 15 / pxPerUnit);
    const maxR = Math.max(minR, 64);
    // 자리가 조금 남도록 크기를 골라 나무 전체에 고르게 퍼지게 한다
    const roomy = Math.ceil(n * 1.3) + 2;
    for (let R = maxR; R > minR; R -= 2) {
      const pts = slots(theme, R);
      if (pts.length >= roomy) return { R, pts, zoom: 1 };
    }
    const tight = slots(theme, minR);
    if (tight.length >= n) return { R: minR, pts: tight, zoom: 1 };
    let R = minR, pts = slots(theme, R);
    while (pts.length < n && R > 6) { R *= 0.95; pts = slots(theme, R); }
    return { R, pts, zoom: minR / R };
  }

  /* ---------- SVG 도우미 ---------- */
  function el(name, attrs, parent) {
    const node = document.createElementNS(NS, name);
    for (const k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  // [색, 글자색]
  const PALETTE = {
    christmas: [
      ["#e5383b", "#fff4e6"], ["#f0b83f", "#231803"], ["#f3ead7", "#231c10"],
      ["#f28f9b", "#2b0a10"], ["#8fc7e8", "#06202e"], ["#b9a2e8", "#170b33"],
    ],
    persimmon: [["#ff8f2e", "#2b1203"], ["#f9761a", "#2b1203"], ["#ffa64d", "#2b1203"]],
    cherry: [["#ffd9e4", "#5a1233"], ["#ffc2d4", "#5a1233"], ["#fff0f4", "#5a1233"], ["#f7a8c0", "#4a0d29"]],
  };
  const TREE = {
    christmas: { a: ["#1f9149", "#0f5c2d"], b: ["#8f241a", "#5a130d"], star: "#f6e7b8" },
    persimmon: { a: ["#6f7f2c", "#3f4d17"], b: ["#a1541b", "#6a2f0c"], trunk: "#6b4a2f" },
    cherry: { a: ["#d0668c", "#8f3558"], b: ["#7d3157", "#4f1a37"], trunk: "#6a4552" },
  };

  // 위는 또렷하고 아래로 갈수록 배경에 스며드는 그라디언트
  function fade(d, id, top, bottom, endOpacity) {
    const g = el("linearGradient", { id, x1: 0, y1: 0, x2: 0, y2: 1 }, d);
    el("stop", { offset: "0%", "stop-color": top }, g);
    el("stop", { offset: "55%", "stop-color": bottom, "stop-opacity": 0.9 }, g);
    el("stop", { offset: "100%", "stop-color": bottom, "stop-opacity": endOpacity }, g);
  }

  function defs(svg, theme) {
    const d = el("defs", {}, svg), C = TREE[theme];
    const end = theme === "christmas" ? 0 : 0.18;
    fade(d, "shapeA", C.a[0], C.a[1], end);
    fade(d, "shapeB", C.b[0], C.b[1], end);
    if (C.trunk) {
      const g = el("linearGradient", { id: "trunk", x1: 0, y1: 0, x2: 0, y2: 1 }, d);
      el("stop", { offset: "0%", "stop-color": C.trunk }, g);
      el("stop", { offset: "100%", "stop-color": C.trunk, "stop-opacity": 0 }, g);
    }
    PALETTE[theme].forEach(([c], i) => {
      const g = el("linearGradient", { id: "item" + i, x1: 0, y1: 0, x2: 0, y2: 1 }, d);
      el("stop", { offset: "35%", "stop-color": c }, g);
      el("stop", { offset: "100%", "stop-color": c, "stop-opacity": 0.74 }, g);
    });
  }

  /* ---------- 나무 그리기 ---------- */
  function drawChristmas(svg) {
    TIERS.forEach(([ay, by, hw], i) => {
      const h = by - ay, cx = hw * KX, cy = ay + h * KY;
      el("path", {
        d: `M500 ${ay} Q${500 + cx} ${cy} ${500 + hw} ${by} L${500 - hw} ${by} Q${500 - cx} ${cy} 500 ${ay} Z`,
        fill: `url(#shape${i % 2 ? "B" : "A"})`,
      }, svg);
    });
    // 꼭대기의 작은 반짝임
    const s = 34, k = 7, y = 52;
    el("path", {
      d: `M500 ${y - s} Q${500 + k} ${y - k} ${500 + s} ${y} Q${500 + k} ${y + k} 500 ${y + s} ` +
         `Q${500 - k} ${y + k} ${500 - s} ${y} Q${500 - k} ${y - k} 500 ${y - s} Z`,
      fill: TREE.christmas.star,
    }, svg);
  }

  function drawBlobTree(svg) {
    el("path", {
      d: "M486 560 C490 760 484 930 470 1100 L530 1100 C516 930 510 760 514 560 Z",
      fill: "url(#trunk)",
    }, svg);
    el("path", {
      d: "M496 800 C440 760 380 730 330 660 M504 760 C560 720 620 700 668 640",
      stroke: "url(#trunk)", "stroke-width": 14, "stroke-linecap": "round", fill: "none",
    }, svg);
    BLOBS.forEach(([cx, cy, r], i) => {
      el("circle", { cx, cy, r, fill: `url(#shape${[1, 2, 6, 7].includes(i) ? "B" : "A"})` }, svg);
    });
  }

  /* ---------- 카드 한 개 ---------- */
  function fitName(name, R, pxPerUnit) {
    const units = (s) => Array.from(s).reduce((n, ch) => n + (ch.charCodeAt(0) < 128 ? 0.6 : 1), 0);
    const width = R * 1.72;
    const minFont = Math.min(R * 0.6, 8.5 / pxPerUnit);
    let text = name, size = Math.min(R * 0.62, width / units(text));
    if (size < minFont) {
      const chars = Array.from(name);
      while (chars.length > 1 && width / (units(chars.join("")) + 0.7) < minFont) chars.pop();
      text = chars.join("") + "…";
      size = Math.max(minFont, Math.min(R * 0.62, width / units(text)));
    }
    return { text, size };
  }

  // 오너먼트 볼 / 감 / 벚꽃 모양 (글자 제외)
  function drawShape(parent, theme, card, R) {
    const pal = PALETTE[theme], i = card.id % pal.length, fill = `url(#item${i})`;
    if (theme === "christmas") {
      el("circle", { r: R, fill }, parent);
    } else if (theme === "persimmon") {
      el("ellipse", { rx: R, ry: R * 0.92, cy: R * 0.04, fill }, parent);
      const cal = el("g", { transform: `translate(0 ${-R * 0.84})`, fill: "#3f5a1c" }, parent);
      for (let k = 0; k < 4; k++) {
        el("ellipse", { rx: R * 0.26, ry: R * 0.1, cx: R * 0.2, transform: `rotate(${k * 90 + 45})` }, cal);
      }
    } else {
      const rot = (card.id * 37) % 72;
      const fl = el("g", { transform: `rotate(${rot})`, fill }, parent);
      for (let k = 0; k < 5; k++) {
        el("circle", { cx: 0, cy: -R * 0.56, r: R * 0.5, transform: `rotate(${k * 72})` }, fl);
      }
      el("circle", { r: R * 0.6, fill: pal[i][0] }, parent);
    }
    return pal[i][1];
  }

  function drawItem(parent, theme, card, x, y, R, pxPerUnit) {
    const g = el("g", {
      class: "item", tabindex: 0, role: "button",
      "aria-label": card.author + "님의 메시지 보기",
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
    }, parent);
    const inner = el("g", { class: "item-in" }, g);
    const ink = drawShape(inner, theme, card, R);
    const { text, size } = fitName(card.author, R, pxPerUnit);
    const t = el("text", {
      x: 0, y: theme === "persimmon" ? R * 0.06 : 0, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": size.toFixed(1), "font-weight": 700, fill: ink, class: "item-name",
    }, g);
    t.textContent = text;
    return g;
  }

  // 메시지 창에 보여줄 작은 아이콘
  function icon(theme, card) {
    const svg = el("svg", { viewBox: "-60 -62 120 124", width: 56, height: 58, "aria-hidden": "true" });
    drawShape(svg, theme, card, 48);
    return svg;
  }

  /* ---------- 공개 API ---------- */
  function render(svg, theme, cards, opts) {
    opts = opts || {};
    const stagePx = opts.stagePx || 560;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
    defs(svg, theme);
    if (theme === "christmas") drawChristmas(svg);
    else drawBlobTree(svg);

    const lay = layout(theme, cards.length, stagePx);
    const pxPerUnit = (stagePx * lay.zoom) / VB_W;
    const layer = el("g", { class: "items" }, svg);
    cards.forEach((card, i) => {
      const [x, y] = lay.pts[i];
      const g = drawItem(layer, theme, card, x, y, lay.R, pxPerUnit);
      if (card.id === opts.newId) g.classList.add("is-new");
      const open = () => opts.onPick && opts.onPick(card);
      g.addEventListener("click", open);
      g.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
    });
    return { zoom: lay.zoom };
  }

  window.TreeView = { THEMES, render, icon };
})();
