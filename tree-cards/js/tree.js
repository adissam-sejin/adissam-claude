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
  // 크리스마스 트리: 삼각형 단 [꼭짓점 y, 밑변 y, 밑변 반폭]
  const TIERS = [
    [105, 430, 215],
    [250, 680, 320],
    [450, 960, 430],
  ];
  // 감나무·벚꽃나무: 잎/꽃 덩어리 [cx, cy, r]
  const BLOBS = [
    [500, 190, 150], [335, 250, 145], [665, 250, 145],
    [500, 340, 225], [300, 430, 190], [700, 430, 190],
    [185, 560, 150], [815, 560, 150], [400, 600, 180], [600, 600, 180],
  ];

  function insidePoint(theme, x, y) {
    if (theme === "christmas") {
      for (const [ay, by, hw] of TIERS) {
        if (y >= ay && y <= by && Math.abs(x - 500) <= (hw * (y - ay)) / (by - ay)) return true;
      }
      return false;
    }
    for (const [cx, cy, r] of BLOBS) {
      if ((x - cx) * (x - cx) + (y - cy) * (y - cy) <= r * r) return true;
    }
    return false;
  }
  function fits(theme, x, y, R) {
    const m = R * 0.85;
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
    for (let y = 60; y < 1000; y += dy, row++) {
      for (let x = (row % 2 ? dx / 2 : 0) + 20; x < VB_W; x += dx) {
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
    const roomy = Math.ceil(n * 1.15) + 1;
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

  const BALLS = [
    ["#ff8787", "#c92a2a", "#fff"], ["#ffe066", "#e08e00", "#5c3d00"],
    ["#74c0fc", "#1864ab", "#fff"], ["#b197fc", "#5f3dc4", "#fff"],
    ["#faa2c1", "#a61e4d", "#fff"], ["#f8f9fa", "#909aa3", "#343a40"],
    ["#63e6be", "#087f5b", "#fff"],
  ];
  const BLOSSOMS = [
    ["#ffffff", "#ffd6e3"], ["#ffe3ec", "#ffb3cb"], ["#ffd0df", "#ff9dbd"], ["#fff0f5", "#ffc2d6"],
  ];

  function defs(svg) {
    const d = el("defs", {}, svg);
    BALLS.forEach(([a, b], i) => {
      const g = el("radialGradient", { id: "ball" + i, cx: "35%", cy: "30%", r: "75%" }, d);
      el("stop", { offset: "0%", "stop-color": a }, g);
      el("stop", { offset: "100%", "stop-color": b }, g);
    });
    const p = el("radialGradient", { id: "gam", cx: "38%", cy: "30%", r: "78%" }, d);
    el("stop", { offset: "0%", "stop-color": "#ffb04d" }, p);
    el("stop", { offset: "100%", "stop-color": "#e8590c" }, p);
    BLOSSOMS.forEach(([a, b], i) => {
      const g = el("radialGradient", { id: "petal" + i, cx: "50%", cy: "50%", r: "60%" }, d);
      el("stop", { offset: "0%", "stop-color": a }, g);
      el("stop", { offset: "100%", "stop-color": b }, g);
    });
    const sh = el("filter", { id: "soft", x: "-30%", y: "-30%", width: "160%", height: "170%" }, d);
    el("feDropShadow", { dx: 0, dy: 3, stdDeviation: 3, "flood-color": "#000", "flood-opacity": 0.22 }, sh);
  }

  /* ---------- 나무 그리기 ---------- */
  function drawChristmas(svg) {
    el("ellipse", { cx: 500, cy: 1085, rx: 430, ry: 42, fill: "#eef4ff", opacity: 0.95 }, svg);
    el("rect", { x: 452, y: 930, width: 96, height: 150, rx: 10, fill: "#7a4a25" }, svg);
    el("rect", { x: 452, y: 930, width: 34, height: 150, rx: 10, fill: "#8f5a30" }, svg);
    const greens = ["#2f9e63", "#278653", "#1f7046"];
    for (let i = TIERS.length - 1; i >= 0; i--) {
      const [ay, by, hw] = TIERS[i];
      const l = 500 - hw - 18, r = 500 + hw + 18, n = 4 + i;
      // 밑단을 둥글게 물결 모양으로
      let d = `M500 ${ay - 14} L${r} ${by} `;
      const step = (r - l) / n;
      for (let k = 0; k < n; k++) {
        const x1 = r - step * k, x2 = x1 - step;
        d += `Q${(x1 + x2) / 2} ${by + 46} ${x2} ${by} `;
      }
      d += "Z";
      el("path", { d, fill: "#0e4a2c", opacity: 0.35, transform: "translate(0,14)" }, svg);
      el("path", { d, fill: greens[i], "stroke-linejoin": "round" }, svg);
      el("path", {
        d: `M500 ${ay - 14} L${l} ${by} Q${l + step / 2} ${by + 46} ${l + step} ${by} L500 ${ay + 40} Z`,
        fill: "#fff", opacity: 0.07,
      }, svg);
    }
    // 꼭대기 별
    let star = "";
    for (let i = 0; i < 10; i++) {
      const a = (Math.PI / 5) * i - Math.PI / 2, rad = i % 2 ? 26 : 60;
      star += (i ? "L" : "M") + (500 + Math.cos(a) * rad).toFixed(1) + " " + (82 + Math.sin(a) * rad).toFixed(1);
    }
    el("circle", { cx: 500, cy: 82, r: 76, fill: "#ffe066", opacity: 0.16 }, svg);
    el("path", { d: star + "Z", fill: "#ffd43b", stroke: "#f59f00", "stroke-width": 4, "stroke-linejoin": "round" }, svg);
  }

  function drawBlobTree(svg, theme) {
    const C = theme === "persimmon"
      ? { ground: "#d9c08a", trunk: "#6b4226", trunkHi: "#855635", back: "#6f8a34", mid: "#8ea544", hi: "#aabd5a" }
      : { ground: "#ffd9e6", trunk: "#5a3a36", trunkHi: "#75504a", back: "#f6b1c8", mid: "#fbcbdb", hi: "#ffe1eb" };
    el("ellipse", { cx: 500, cy: 1088, rx: 400, ry: 38, fill: C.ground }, svg);
    const trunk =
      "M440 1090 C455 980 462 900 455 800 C420 760 360 720 300 640 L335 625 C385 690 430 720 470 735 " +
      "C478 660 480 600 470 520 L530 520 C522 600 524 660 532 735 C572 720 615 690 665 625 L700 640 " +
      "C640 720 580 760 545 800 C538 900 545 980 560 1090 Z";
    el("path", { d: trunk, fill: C.trunk }, svg);
    el("path", { d: "M468 1090 C478 980 482 900 476 800 L500 780 L500 1090 Z", fill: C.trunkHi, opacity: 0.6 }, svg);
    const order = BLOBS.slice().sort((a, b) => b[1] - a[1]);
    order.forEach(([cx, cy, r]) => el("circle", { cx, cy: cy + 16, r: r + 12, fill: C.back }, svg));
    order.forEach(([cx, cy, r]) => el("circle", { cx, cy, r: r + 6, fill: C.mid }, svg));
    const rand = rng(theme === "persimmon" ? 11 : 23);
    BLOBS.forEach(([cx, cy, r]) => {
      for (let i = 0; i < 4; i++) {
        const a = rand() * Math.PI * 2, d = rand() * r * 0.6;
        el("circle", {
          cx: cx + Math.cos(a) * d, cy: cy + Math.sin(a) * d - r * 0.15,
          r: r * (0.22 + rand() * 0.2), fill: C.hi, opacity: 0.55,
        }, svg);
      }
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

  function drawItem(parent, theme, card, x, y, R, pxPerUnit) {
    const seed = rng(card.id * 2654435761);
    const g = el("g", {
      class: "item", tabindex: 0, role: "button",
      "aria-label": card.author + "님의 메시지 보기",
      transform: `translate(${x.toFixed(1)} ${y.toFixed(1)})`,
    }, parent);
    const inner = el("g", { class: "item-in", filter: "url(#soft)" }, g);
    let ink = "#fff", halo = null;

    if (theme === "christmas") {
      const i = card.id % BALLS.length;
      ink = BALLS[i][2];
      el("path", { d: `M0 ${-R * 1.34} v${R * 0.2}`, stroke: "#f1c40f", "stroke-width": R * 0.07, fill: "none" }, inner);
      el("rect", { x: -R * 0.2, y: -R * 1.16, width: R * 0.4, height: R * 0.26, rx: R * 0.06, fill: "#e0b03a" }, inner);
      el("circle", { r: R, fill: `url(#ball${i})` }, inner);
      el("ellipse", { cx: -R * 0.36, cy: -R * 0.46, rx: R * 0.26, ry: R * 0.15, fill: "#fff", opacity: 0.5, transform: `rotate(-32 ${-R * 0.36} ${-R * 0.46})` }, inner);
      halo = ink === "#fff" ? BALLS[i][1] : null;
    } else if (theme === "persimmon") {
      el("ellipse", { rx: R, ry: R * 0.9, cy: R * 0.06, fill: "url(#gam)" }, inner);
      el("ellipse", { cx: -R * 0.38, cy: -R * 0.36, rx: R * 0.24, ry: R * 0.13, fill: "#fff", opacity: 0.4, transform: `rotate(-30 ${-R * 0.38} ${-R * 0.36})` }, inner);
      const cal = el("g", { transform: `translate(0 ${-R * 0.8})` }, inner);
      for (let k = 0; k < 4; k++) {
        el("ellipse", { rx: R * 0.3, ry: R * 0.13, cx: R * 0.26, fill: k % 2 ? "#4f772d" : "#5f8d38", transform: `rotate(${k * 90 + 45}) scale(1 .8)` }, cal);
      }
      el("rect", { x: -R * 0.05, y: -R * 0.3, width: R * 0.1, height: R * 0.3, rx: R * 0.04, fill: "#5a3d1e", transform: `translate(0 ${-R * 0.8})` }, inner);
      halo = "#c2410c";
    } else {
      const i = card.id % BLOSSOMS.length;
      const rot = Math.floor(seed() * 72);
      const fl = el("g", { transform: `rotate(${rot})` }, inner);
      for (let k = 0; k < 5; k++) {
        // 끝이 살짝 갈라진 꽃잎
        const d = `M0 0 C${-R * 0.62} ${-R * 0.3} ${-R * 0.6} ${-R * 1.02} ${-R * 0.16} ${-R * 1.06} ` +
          `L0 ${-R * 0.9} L${R * 0.16} ${-R * 1.06} C${R * 0.6} ${-R * 1.02} ${R * 0.62} ${-R * 0.3} 0 0 Z`;
        el("path", { d, fill: `url(#petal${i})`, stroke: "#f29bb8", "stroke-width": R * 0.03, transform: `rotate(${k * 72})` }, fl);
      }
      el("circle", { r: R * 0.52, fill: "#fff", opacity: 0.72 }, inner);
      ink = "#a61e4d";
    }

    const { text, size } = fitName(card.author, R, pxPerUnit);
    const t = el("text", {
      x: 0, y: theme === "persimmon" ? R * 0.1 : 0, "text-anchor": "middle", "dominant-baseline": "central",
      "font-size": size.toFixed(1), "font-weight": 700, fill: ink, class: "item-name",
    }, g);
    if (halo) {
      t.setAttribute("stroke", halo);
      t.setAttribute("stroke-width", (size * 0.12).toFixed(1));
      t.setAttribute("paint-order", "stroke");
      t.setAttribute("stroke-linejoin", "round");
    }
    t.textContent = text;
    return g;
  }

  /* ---------- 공개 API ---------- */
  function render(svg, theme, cards, opts) {
    opts = opts || {};
    const stagePx = opts.stagePx || 560;
    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute("viewBox", `0 0 ${VB_W} ${VB_H}`);
    defs(svg);
    if (theme === "christmas") drawChristmas(svg);
    else drawBlobTree(svg, theme);

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

  window.TreeView = { THEMES, render };
})();
