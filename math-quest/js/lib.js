/* 수학 원정대 — 문제 생성 도구 모음 (DOM 없이 동작) */
(function (g) {
  'use strict';
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const P = a => a[R(0, a.length - 1)];
  const NZ = (a, b) => { let v; do v = R(a, b); while (!v); return v; };
  const shuf = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = R(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a; };
  const lcm = (a, b) => a / gcd(a, b) * b;

  /* 표기 */
  const M = v => String(v).replace(/-/g, '−');            // 음수 부호를 수학 기호로
  const N = v => v < 0 ? `(${M(v)})` : `${v}`;             // 음수는 괄호
  const S = v => v < 0 ? M(v) : `+${v}`;                   // 부호를 항상 표시
  const Sp = v => `${v < 0 ? '−' : '+'} ${Math.abs(v)}`;      // 연산 기호처럼 띄어서 표시
  const frRaw = (n, d) => `<span class="fr"><i>${n}</i><i>${d}</i></span>`;
  const fr = (n, d) => {                                   // 기약분수로 표시
    if (d < 0) { n = -n; d = -d; }
    const k = gcd(n, d) || 1; n /= k; d /= k;
    if (d === 1) return M(n);
    return `${n < 0 ? '−' : ''}${frRaw(Math.abs(n), d)}`;
  };
  const Nf = (n, d) => (n * d < 0) ? `(${fr(n, d)})` : fr(n, d);
  const sq = x => `<span class="rt">√<span class="ov">${x}</span></span>`;
  const pw = (b, e) => e === 1 ? `${b}` : `${b}<sup>${e}</sup>`;
  const X2 = 'x<sup>2</sup>';
  const dot = s => { s = String(s); const d = c => `<span class="dt">${c}</span>`; return s.length === 1 ? d(s) : d(s[0]) + s.slice(1, -1) + d(s[s.length - 1]); };
  const poly = terms => {                                  // [[계수, 문자], ...] → 2x − 3
    let s = '';
    for (const [c, v] of terms) {
      if (!c) continue;
      const a = Math.abs(c), body = (a === 1 && v) ? v : a + v;
      s += s ? (c < 0 ? ' − ' : ' + ') + body : (c < 0 ? '−' : '') + body;
    }
    return s || '0';
  };
  const B = (a, b, v = 'x') => `(${poly([[a, v], [b, '']])})`;   // (ax + b)
  const mono = (c, vs) => {                                // 단항식: 계수와 [[문자, 지수]]
    const body = vs.filter(t => t[1] > 0).map(([v, e]) => pw(v, e)).join('');
    if (!body) return M(c);
    return (c === 1 ? '' : c === -1 ? '−' : M(c)) + body;
  };
  const sys = (a, b) => `<span class="sys"><span>${a}</span><span>${b}</span></span>`;
  const data = arr => `<span class="data">${arr.join(',&nbsp; ')}</span>`;
  const gon = n => ['', '', '', '삼', '사', '오', '육', '칠', '팔', '구', '십', '십일', '십이', '', '', '십오', '', '', '십팔', '', '이십'][n] + '각형';

  /* 그림 */
  const fig = {
    tri(ab, bc, ca) {   // ∠C = 90° 직각삼각형
      return `<svg class="fig" viewBox="0 0 250 140" role="img" aria-label="직각삼각형 ABC"><polygon points="24,112 204,112 204,24"/><polyline points="190,112 190,98 204,98"/>
<text x="10" y="120">A</text><text x="210" y="20">B</text><text x="210" y="126">C</text>
<text x="96" y="58" text-anchor="end">${ab}</text><text x="212" y="72">${bc}</text><text x="114" y="131" text-anchor="middle">${ca}</text></svg>`;
    },
    zig(a, b) {         // 평행선 사이의 꺾인 선
      return `<svg class="fig" viewBox="0 0 250 140" role="img" aria-label="평행선 사이에서 꺾인 선"><line x1="12" y1="24" x2="238" y2="24"/><line x1="12" y1="116" x2="238" y2="116"/><polyline points="180,24 84,70 190,116"/>
<text x="240" y="20" text-anchor="end">l</text><text x="240" y="134" text-anchor="end">m</text><text x="184" y="18">A</text><text x="66" y="75">P</text><text x="194" y="134">B</text>
<text x="136" y="40" text-anchor="end">${a}°</text><text x="142" y="110" text-anchor="end">${b}°</text><text x="100" y="75">?</text></svg>`;
    }
  };

  /* 조사 자동 선택: "3을(를)" → "3을", "x을(를)" → "x를" */
  const JO = { '을(를)': ['을', '를'], '와(과)': ['과', '와'], '은(는)': ['은', '는'], '이(가)': ['이', '가'], '(으)로': ['으로', '로'] };
  const josa = s => s.replace(/([0-9A-Za-z가-힣°])((?:\)|<\/(?:sup|span|b)>)*)(을\(를\)|와\(과\)|은\(는\)|이\(가\)|\(으\)로)/g, (m, ch, tags, j) => {
    let bat, ri = false;
    if (tags.includes('</sup>')) bat = true;                                   // …제곱
    else if (/\d/.test(ch)) { bat = '013678'.includes(ch); ri = '178'.includes(ch); }
    else if (ch === '°') bat = false;
    else if (/[A-Za-z]/.test(ch)) { const c = ch.toLowerCase(); bat = 'lmnr'.includes(c); ri = 'lr'.includes(c); }
    else { const k = (ch.charCodeAt(0) - 0xAC00) % 28; bat = k !== 0; ri = k === 8; }
    const [x, y] = JO[j];
    return ch + tags + (j === '(으)로' ? (bat && !ri ? x : y) : (bat ? x : y));
  });
  const josaFr = s => s.replace(/(<span class="fr"><i>[^<]*?([0-9A-Za-z])<\/i><i>[^<]*<\/i><\/span>\)?)(을\(를\)|와\(과\)|은\(는\)|이\(가\)|\(으\)로)/g, (m, body, ch, j) => body + josa(ch + j).slice(1));   // 분수는 분자를 마지막에 읽는다
  const fix = s => josaFr(josa(String(s))).replace(/ < /g, ' &lt; ').replace(/ > /g, ' &gt; ');

  /* 답 */
  const norm = (n, d) => { if (d < 0) { n = -n; d = -d; } const k = gcd(n, d) || 1; return { n: n / k, d: d / k }; };
  const ratOf = v => {
    if (Array.isArray(v)) return norm(v[0], v[1]);
    if (Number.isInteger(v)) return { n: v, d: 1 };
    const s = String(+v.toFixed(6)), k = (s.split('.')[1] || '').length;
    return norm(Math.round(v * 10 ** k), 10 ** k);
  };
  /* 숫자 입력 문제. ans: 정수, 소수, 또는 [분자, 분모] */
  function num(q, ans, exp, o) {
    const a = ratOf(ans);
    if (!Number.isFinite(a.n) || !Number.isFinite(a.d) || !a.d) return null;
    return { t: 'num', q: fix(q), a, aH: fr(a.n, a.d), exp: fix(exp || ''), pre: (o && o.pre) || '', u: (o && o.u) || '' };
  }
  /* 객관식 문제. 오답이 3개 미만이면 null (다시 생성) */
  function mc(q, correct, wrongs, exp, o) {
    const str = x => fix(typeof x === 'number' ? M(x) : x);
    correct = str(correct);
    let opts;
    if (o && o.order) opts = o.order.map(str);
    else {
      const seen = new Set([correct]), w = [];
      for (const x of wrongs.map(str)) { if (!seen.has(x)) { seen.add(x); w.push(x); } if (w.length === 3) break; }
      if (w.length < 3) return null;
      opts = shuf([correct, ...w]);
    }
    const a = opts.indexOf(correct);
    if (a < 0) return null;
    return { t: 'mc', q: fix(q), opts, a, aH: correct, exp: fix(exp || '') };
  }
  function parseAns(s) {
    s = String(s).trim().replace(/−/g, '-').replace(/\s/g, '');
    const m = /^(-?)(\d+)(?:\.(\d+))?(?:\/(\d+))?$/.exec(s);
    if (!m) return null;
    let n = +(m[2] + (m[3] || '')), d = 10 ** (m[3] || '').length;
    if (m[4] !== undefined) { if (!+m[4]) return null; d *= +m[4]; }
    if (m[1]) n = -n;
    return norm(n, d);
  }
  function check(p, input) {
    if (p.t === 'mc') return input === p.a;
    const r = parseAns(input);
    return !!r && r.n === p.a.n && r.d === p.a.d;
  }
  /* 한 단계(또는 문제은행)용 문제 뽑기 */
  function make(gens) {
    for (let i = 0; i < 80; i++) { const p = P(gens)(); if (p) return p; }
    throw new Error('문제를 만들지 못했습니다');
  }
  function makeSet(gens, n) {
    const out = [], seen = new Set();
    let order = [];
    while (out.length < n) {
      if (!order.length) order = shuf(gens);
      const gfn = order.pop();
      let p = null;
      for (let i = 0; i < 60 && !p; i++) { const c = gfn(); if (c && !seen.has(c.q)) p = c; }
      if (!p) p = make(gens);
      seen.add(p.q); out.push(p);
    }
    return shuf(out);
  }

  g.MQ = { R, P, NZ, shuf, gcd, lcm, M, N, S, Sp, josa, fr, frRaw, Nf, sq, pw, X2, dot, poly, B, mono, sys, data, gon, fig, num, mc, parseAns, check, make, makeSet, concepts: [] };
})(typeof window !== 'undefined' ? window : globalThis);
