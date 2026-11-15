const assert = require('assert');
const D = require('../js/data.js'), E = require('../js/engine.js');
const names = new Set(D.FOODS.map(f => f.name));
D.FOODS.forEach(f => assert(/^[+0-]{8}$/.test(f.r), f.name));
[...D.MENUS, ...D.DISHES].forEach(m => m.ing.forEach(n => assert(names.has(n), `${m.name}: ${n}`)));
D.QUESTIONS.forEach(q => assert.strictEqual(q.v.length, 8));
// 각 체질의 "전형적인 응답"이 그 체질로 판정되는지
D.TYPES.forEach((t, i) => {
  const ans = {};
  D.QUESTIONS.forEach(q => { ans[q.id] = Math.sign(q.v[i]); });
  const r = E.score(ans);
  assert.strictEqual(r.top, i, `${t.name} -> ${D.TYPES[r.top].name}`);
  assert(r.ranking[0].pct === 100);
});
assert.strictEqual(E.score({}).ranking[0].pct, 50);
// 식단: 모든 체질 × 끼니 수에서 7일이 채워지고 해로운 재료가 없어야 함
const fb = Object.fromEntries(D.FOODS.map(f => [f.name, f]));
D.TYPES.forEach((t, i) => {
  for (const role of ['staple', 'protein', 'veg', 'soup', 'snack']) assert(E.pool(i, role).length >= 4, `${t.name} ${role} ${E.pool(i, role).length}`);
  for (const n of [2, 3, 4, 5]) {
    const p = E.plan(i, n, 42);
    assert.strictEqual(p.length, 7);
    p.forEach(d => { assert.strictEqual(d.meals.length, n); d.meals.forEach(m => m.dishes.forEach(x => x.ing.forEach(g => assert(E.rate(fb[g], i) >= 0)))); });
    assert.deepStrictEqual(E.plan(i, n, 42), p);
  }
  const p = E.plan(i, 3, 7); const k = p.map(d => d.total.kcal);
  console.log(t.name, 'kcal/일', Math.min(...k), '~', Math.max(...k), '단백질', Math.round(p.reduce((s, d) => s + d.total.p, 0) / 7) + 'g');
});
assert.strictEqual(E.check('삼겹살', 0).verdict, -1);
assert.strictEqual(E.check('삼겹살', 2).verdict, 1);
assert.strictEqual(E.check('배', 4).title, '배');
assert.strictEqual(E.check('김치찌개', 6).kind, 'menu');
assert.strictEqual(E.check('매운 삼겹살 구이', 6).title, '돼지고기');
assert.strictEqual(E.check('zzzz', 0).found, false);
console.log('ok');
