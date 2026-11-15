/* 판정·음식 확인·식단 생성 로직 (화면과 분리된 순수 함수) */
(function (root) {
  const D = (typeof module !== 'undefined' && module.exports) ? require('./data.js') : root.C8;
  const { TYPES, FOODS, MENUS, QUESTIONS, WHY, DISHES, CATS } = D;
  const VAL = { '+': 1, '0': 0, '-': -1 };
  const foodByName = Object.fromEntries(FOODS.map(f => [f.name, f]));
  const rate = (food, idx) => VAL[food.r[idx]];

  // answers: { [questionId]: 1 | 0 | -1 | null }
  function score(answers) {
    const sum = Array(8).fill(0), max = Array(8).fill(0);
    let answered = 0;
    for (const q of QUESTIONS) {
      const a = answers[q.id];
      if (a === null || a === undefined) continue;
      answered++;
      q.v.forEach((w, i) => { sum[i] += a * w; max[i] += Math.abs(w); });
    }
    const ranking = TYPES.map((t, i) => ({ idx: i, id: t.id, pct: max[i] ? Math.round(50 + 50 * sum[i] / max[i]) : 50, raw: sum[i] }))
      .sort((a, b) => b.pct - a.pct || b.raw - a.raw);
    return { ranking, top: ranking[0].idx, answered, total: QUESTIONS.length,
      reliable: answered >= 15 && ranking[0].pct - ranking[1].pct >= 5 };
  }

  function foodLists(idx) {
    const good = {}, bad = {};
    for (const f of FOODS) {
      const r = rate(f, idx);
      if (r > 0) (good[f.cat] = good[f.cat] || []).push(f.name);
      if (r < 0) (bad[f.cat] = bad[f.cat] || []).push(f.name);
    }
    return { good, bad };
  }

  const norm = s => String(s || '').toLowerCase().replace(/\s+/g, '');
  function find(query) {
    const q = norm(query);
    if (!q) return null;
    const names = f => [f.name, ...f.alias].map(norm);
    let hit = FOODS.find(f => names(f).includes(q));
    if (hit) return { kind: 'food', food: hit };
    let m = MENUS.find(x => norm(x.name) === q) || DISHES.find(x => norm(x.name) === q);
    if (m) return { kind: 'menu', menu: m };
    m = MENUS.find(x => q.includes(norm(x.name)) || (q.length >= 2 && norm(x.name).includes(q)))
      || DISHES.find(x => q.length >= 2 && (norm(x.name).includes(q) || q.includes(norm(x.name))));
    if (m) return { kind: 'menu', menu: m };
    // 입력 안에 들어 있는 가장 긴 재료명
    let best = null, bestLen = 0;
    for (const f of FOODS) for (const n of names(f)) {
      if (q.includes(n) && n.length > bestLen) { best = f; bestLen = n.length; }
    }
    if (best) return { kind: 'food', food: best, partial: true };
    if (q.length >= 2) {
      hit = FOODS.find(f => names(f).some(n => n.includes(q)));
      if (hit) return { kind: 'food', food: hit, partial: true };
    }
    return null;
  }

  function why(idx, food, r) {
    const g = WHY[TYPES[idx].group];
    if (r === 0) return '이 체질에는 특별히 이롭지도 해롭지도 않은 음식으로 분류됩니다. 과하지 않게 드시면 됩니다.';
    const spec = (r > 0 ? g.good : g.bad)[food.cat];
    return g.base + ' ' + (spec || (r > 0 ? '이 음식은 약한 장기를 도와 균형을 맞춰 주는 쪽으로 분류됩니다.' : '이 음식은 강한 장기를 더 강하게 하거나 약한 장기에 부담을 주는 쪽으로 분류됩니다.'));
  }

  const LABEL = { 1: '좋아요', 0: '보통', '-1': '안 좋아요' };
  function check(query, idx) {
    const hit = find(query);
    if (!hit) return { found: false };
    if (hit.kind === 'food') {
      const r = rate(hit.food, idx);
      return { found: true, kind: 'food', title: hit.food.name, matched: hit.partial ? hit.food.name : null,
        cat: CATS[hit.food.cat], verdict: r, label: LABEL[r], explain: why(idx, hit.food, r) };
    }
    const parts = hit.menu.ing.map(n => ({ name: n, r: rate(foodByName[n], idx) }));
    const main = parts[0].r, bads = parts.filter(p => p.r < 0), goods = parts.filter(p => p.r > 0);
    let verdict;
    if (main < 0 || bads.length > parts.length / 2) verdict = -1;
    else if (bads.length) verdict = 0;
    else verdict = goods.length ? 1 : 0;
    const list = a => a.map(p => p.name).join(', ');
    let explain;
    if (verdict < 0) explain = `주재료인 ${list(bads)}이(가) 이 체질에 맞지 않는 재료로 분류됩니다.` + (goods.length ? ` ${list(goods)}은(는) 맞는 재료예요.` : '');
    else if (bads.length) explain = `${list(goods.length ? goods : parts.filter(p => p.r === 0))}은(는) 괜찮지만 ${list(bads)}이(가) 맞지 않는 재료입니다. 가끔, 그 재료를 줄여서 드세요.`;
    else if (verdict > 0) explain = `${list(goods)} 등 이 체질에 이로운 재료로 만든 음식입니다.`;
    else explain = '특별히 이롭거나 해로운 재료가 없는 음식입니다.';
    return { found: true, kind: 'menu', title: hit.menu.name, verdict, label: LABEL[verdict], explain, parts };
  }

  // 시드 고정 난수 (같은 시드면 같은 식단)
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function shuffle(a, rand) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

  function pool(idx, role) {
    const ok = [];
    for (const d of DISHES) {
      if (d.role !== role) continue;
      const rs = d.ing.map(n => rate(foodByName[n], idx));
      if (rs.some(r => r < 0)) continue;
      ok.push({ ...d, plus: d.ing.filter((n, i) => rs[i] > 0) });
    }
    const good = ok.filter(d => d.plus.length);
    return good.length >= 4 ? good : good.concat(ok.filter(d => !d.plus.length));
  }

  const MEAL_SETS = {
    2: [['아침 겸 점심', 'full'], ['저녁', 'full']],
    3: [['아침', 'light'], ['점심', 'full'], ['저녁', 'full']],
    4: [['아침', 'light'], ['점심', 'full'], ['간식', 'snack'], ['저녁', 'full']],
    5: [['아침', 'light'], ['오전 간식', 'snack'], ['점심', 'full'], ['오후 간식', 'snack'], ['저녁', 'full']],
  };
  const ROLES = { full: ['staple', 'soup', 'protein', 'veg'], light: ['staple', 'protein', 'veg'], snack: ['snack'] };
  const DAYS = ['월', '화', '수', '목', '금', '토', '일'];

  function plan(idx, mealsPerDay, seed) {
    const set = MEAL_SETS[mealsPerDay] || MEAL_SETS[3];
    const rand = rng(seed);
    const decks = {};
    const draw = role => {
      const d = decks[role] || (decks[role] = { all: pool(idx, role), q: [], last: null });
      if (!d.q.length) {
        d.q = shuffle(d.all, rand);
        if (d.q.length > 1 && d.q[0].name === d.last) d.q.push(d.q.shift());
      }
      const x = d.q.shift(); d.last = x.name; return x;
    };
    return DAYS.map(day => {
      const meals = set.map(([label, kind]) => {
        const dishes = ROLES[kind].map(draw);
        return { label, kind, dishes, kcal: dishes.reduce((s, d) => s + d.kcal, 0) };
      });
      const all = meals.flatMap(m => m.dishes);
      const tot = k => all.reduce((s, d) => s + d[k], 0);
      return { day, meals, total: { kcal: tot('kcal'), p: tot('p'), c: tot('c'), f: tot('f') } };
    });
  }

  const api = { score, foodLists, find, check, plan, rate, MEAL_SETS, pool };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.C8 = Object.assign(root.C8 || {}, api);
})(typeof window !== 'undefined' ? window : globalThis);
