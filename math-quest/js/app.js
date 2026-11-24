/* 수학 원정대 — 게임 진행 (지도, 전투, 보상, 상점) */
(function () {
  'use strict';
  const { concepts, makeSet, make, check, shuf, josa, fr, R, P } = MQ;
  const $ = (s, el) => (el || document).querySelector(s);
  const $$ = (s, el) => [...(el || document).querySelectorAll(s)];
  const app = $('#app'), hud = $('#hud'), overlay = $('#overlay');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const plain = h => h.replace(/<[^>]+>/g, '');

  /* ───── 게임 데이터 ───── */
  const MON = {
    'm1-01': ['🦠', '소수 슬라임'], 'm1-02': ['🐺', '공약수 늑대'], 'm1-03': ['🦇', '음수 박쥐'], 'm1-04': ['👻', '미지수 유령'], 'm1-05': ['🦂', '등호 전갈'],
    'm1-06': ['🕷️', '좌표 거미'], 'm1-07': ['🐍', '평행선 뱀'], 'm1-08': ['🐢', '육각 거북'], 'm1-09': ['🗿', '입체 골렘'], 'm1-10': ['🦉', '평균 올빼미'],
    'm2-01': ['🐙', '순환 문어'], 'm2-02': ['🦖', '거듭제곱 공룡'], 'm2-03': ['🧟', '다항식 좀비'], 'm2-04': ['🐊', '부등호 악어'], 'm2-05': ['👹', '쌍둥이 도깨비'],
    'm2-06': ['🦅', '기울기 독수리'], 'm2-07': ['🦈', '삼각 상어'], 'm2-08': ['🦎', '닮은꼴 도마뱀'], 'm2-09': ['🦍', '빗변 고릴라'], 'm2-10': ['🤡', '확률 광대'],
    'm3-01': ['🌵', '루트 선인장'], 'm3-02': ['🦔', '근호 고슴도치'], 'm3-03': ['🤖', '공식 로봇'], 'm3-04': ['🦀', '분해 꽃게'], 'm3-05': ['🧛', '이차 뱀파이어'],
    'm3-06': ['🦑', '포물선 크라켄'], 'm3-07': ['🦁', '삼각비 사자'], 'm3-08': ['🐡', '원주 복어'], 'm3-09': ['🐝', '분산 벌떼']
  };
  const TIER = ['꼬마 ', '', '킹 '];
  const monOf = c => MON[c.id] || ['👾', '수학 몬스터'];
  const monName = (c, i) => TIER[i] + monOf(c)[1];
  const WORLD = {
    1: { name: '수의 숲', icon: '🌲', boss: ['👿', '숫자 마왕'] },
    2: { name: '식의 사막', icon: '🏜️', boss: ['🐲', '방정식 드래곤'] },
    3: { name: '함수의 성', icon: '🏰', boss: ['☠️', '함수 해골왕'] }
  };
  const SKINS = [['🧒', '모험가', 0], ['🥷', '닌자', 150], ['🧙', '마법사', 150], ['🦸', '히어로', 200], ['🧝', '엘프', 250], ['👽', '외계인', 300], ['🦊', '여우', 350], ['🐯', '호랑이', 400], ['🐼', '판다', 450], ['🦄', '유니콘', 600]];
  const QUESTS = [['win', '전투에서 2번 승리하기', 2, 40], ['ok', '문제 12개 맞히기', 12, 40], ['combo', '5콤보 달성하기', 5, 30]];
  const RANKS = [[1, '🌱', '수학 새싹'], [3, '🧭', '숫자 탐험가'], [6, '🗡️', '계산 검사'], [10, '🛡️', '방정식 기사'], [14, '🧙', '함수 마법사'], [18, '🦉', '도형 현자'], [22, '🦸', '수학 영웅'], [26, '👑', '수학 마스터'], [30, '🐉', '전설의 수학왕']];
  const STAGE = ['개념 확인', '개념 적용', '실전 도전'];
  const GRADE = { 1: '중1', 2: '중2', 3: '중3' };
  const LIMIT = [25, 45, 70];                                  // 스피드 보너스 제한 시간(초)

  /* ───── 저장 ───── */
  const KEY = 'math-quest.v1';
  const fresh = () => ({ xp: 0, gold: 0, hints: 2, st: {}, bank: {}, boss: {}, streak: { d: '', n: 0 }, solved: 0, correct: 0, free: false, grade: 1, skin: '🧒', skins: ['🧒'], weapon: '', mute: false, daily: null });
  let S = fresh();
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && typeof r === 'object') S = Object.assign(fresh(), r); } catch (e) { /* 저장소를 쓸 수 없으면 새로 시작 */ }
  if (!Array.isArray(S.skins) || !S.skins.length) S.skins = ['🧒'];
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };

  /* ───── 효과음 ───── */
  let ac = null;
  const tone = (f, d, type, v, t0) => {
    if (S.mute) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime + (t0 || 0);
      o.type = type || 'square'; o.frequency.value = f;
      g.gain.setValueAtTime(v || .05, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g); g.connect(ac.destination); o.start(t); o.stop(t + d + .02);
    } catch (e) { /* 소리를 낼 수 없는 환경 */ }
  };
  const seq = (fs, d, type, v, gap) => fs.forEach((f, i) => tone(f, d, type, v, i * gap));
  const sfx = {
    hit: () => seq([440, 660], .09, 'square', .05, .07),
    crit: () => seq([523, 659, 784, 1047], .1, 'square', .05, .06),
    miss: () => seq([200, 150], .2, 'sawtooth', .06, .12),
    win: () => seq([523, 659, 784, 1047, 1319], .17, 'triangle', .08, .11),
    lose: () => seq([392, 330, 262, 196], .22, 'triangle', .07, .16),
    coin: () => seq([988, 1319], .1, 'square', .04, .07),
    level: () => seq([392, 523, 659, 784, 1047, 1319], .14, 'triangle', .08, .09)
  };
  const buzz = p => { try { if (navigator.vibrate) navigator.vibrate(p); } catch (e) { /* 무시 */ } };

  /* ───── 레벨·진행 상태 ───── */
  const need = lv => 100 + 20 * (lv - 1);
  const levelOf = xp => { let lv = 1; while (xp >= need(lv)) { xp -= need(lv); lv++; } return { lv, cur: xp, max: need(lv) }; };
  const rankOf = lv => RANKS.filter(r => lv >= r[0]).pop();
  const best = (c, i) => (S.st[c.id] || [0, 0, 0])[i] || 0;
  const cleared = (c, i) => best(c, i) >= 4;
  const starsOf = n => n >= 5 ? 3 : n === 4 ? 2 : n === 3 ? 1 : 0;
  const mastered = c => [0, 1, 2].every(i => cleared(c, i));
  const ofGrade = g => concepts.filter(c => c.g === g);
  const prevOf = c => { const l = ofGrade(c.g), i = l.indexOf(c); return i > 0 ? l[i - 1] : null; };
  const nextOf = c => { const l = ofGrade(c.g), i = l.indexOf(c); return l[i + 1] || null; };
  const cOpen = c => S.free || !prevOf(c) || cleared(prevOf(c), 0);
  const sOpen = (c, i) => cOpen(c) && (S.free || i === 0 || cleared(c, i - 1));
  const bossOpen = g => S.free || ofGrade(g).every(c => cleared(c, 0));
  const bossWon = g => (S.boss[g] || 0) >= 8;
  const nextUp = g => { for (const c of ofGrade(g)) { if (!cOpen(c)) continue; for (let i = 0; i < 3; i++) if (!cleared(c, i) && sOpen(c, i)) return { c, i }; } return null; };
  const dstr = d => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const today = () => dstr(new Date()), yesterday = () => dstr(new Date(Date.now() - 864e5));
  const touchStreak = () => { const t = today(); if (S.streak.d !== t) S.streak = { d: t, n: S.streak.d === yesterday() ? S.streak.n + 1 : 1 }; };
  const streakNow = () => (S.streak.d === today() || S.streak.d === yesterday()) ? S.streak.n : 0;
  const daily = () => { const t = today(); if (!S.daily || S.daily.d !== t) S.daily = { d: t, win: 0, ok: 0, combo: 0, got: [0, 0, 0] }; return S.daily; };
  const weapon = () => { const c = S.weapon && concepts.find(x => x.id === S.weapon); return c && mastered(c) ? c.item : ['✏️', '연필']; };

  /* ───── 상태판 ───── */
  let pendingLv = null;
  function drawHud(pop) {
    const L = levelOf(S.xp), r = rankOf(L.lv);
    hud.innerHTML = `<a class="avatar" href="#me" aria-label="내 캐릭터">${S.skin}</a>
      <div class="hud-mid"><div class="hud-name"><span class="lv">Lv.${L.lv}</span><span>${r[2]}</span></div>
      <div class="xpbar" role="progressbar" aria-label="경험치" aria-valuemin="0" aria-valuemax="${L.max}" aria-valuenow="${L.cur}"><i style="width:${Math.round(L.cur / L.max * 100)}%"></i></div>
      <div class="xpnum">XP ${L.cur} / ${L.max}</div></div>
      <div class="hud-side"><span class="chip" title="연속 접속일">🔥 ${streakNow()}</span><a class="chip gold" href="#shop" title="상점">🪙 ${S.gold}</a></div>
      ${pop ? `<span class="xp-pop">${pop}</span>` : ''}`;
  }
  function addXp(n) {
    if (!n) return;
    const before = levelOf(S.xp).lv; S.xp += n; const after = levelOf(S.xp).lv;
    if (after > before) { S.gold += 50 * (after - before); pendingLv = { from: pendingLv ? pendingLv.from : before, to: after }; }
    save(); drawHud(`+${n} XP`);
  }
  function showLevelUp() {
    if (!pendingLv) return;
    const { from, to } = pendingLv; pendingLv = null;
    const r = rankOf(to), newRank = rankOf(from) !== r;
    overlay.innerHTML = `<div class="levelup" role="dialog" aria-modal="true" aria-label="레벨 업"><div class="big">${S.skin}</div><h2>LEVEL UP!</h2><div class="num">Lv.${from} → Lv.${to}</div>
      <p>${newRank ? josa(`새 칭호 <b style="color:var(--gold)">${r[1]} ${r[2]}</b>을(를) 얻었다!`) : '점점 강해지고 있다!'}<br>보상 🪙 ${50 * (to - from)}</p>
      <button class="btn primary" id="lv-ok" type="button">계속하기</button></div>`;
    overlay.hidden = false; confetti(90); sfx.level(); drawHud();
    $('#lv-ok').focus();
    $('#lv-ok').onclick = () => { overlay.hidden = true; overlay.innerHTML = ''; };
  }

  /* ───── 색종이 ───── */
  const fx = $('#fx');
  function confetti(n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !fx.getContext) return;
    const ctx = fx.getContext('2d'), W = fx.width = innerWidth, H = fx.height = innerHeight;
    const col = ['#ffc93c', '#ff5d73', '#4cc9f0', '#3ddc97', '#a58bff'];
    const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - .5) * W * .5, y: H * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3, s: 5 + Math.random() * 6, r: Math.random() * 6, c: col[Math.floor(Math.random() * col.length)] }));
    let t = 0;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.vy += .32; p.x += p.vx; p.y += p.vy; p.r += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); }
      if (++t < 130) requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
    })();
  }
  let toastT;
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ───── 홈: 월드 지도 ───── */
  const DX = [0, 16, 30, 16, 0, 12, 26, 12];
  function viewHome() {
    const g = S.grade, list = ofGrade(g), up = nextUp(g), W = WORLD[g], d = daily();
    let unit = '', k = 0;
    const nodes = list.map(c => {
      const open = cOpen(c), done = mastered(c), cur = up && up.c === c, m = monOf(c);
      const flag = c.unit !== unit ? `<div class="unit-flag">${esc(unit = c.unit)}</div>` : '';
      const pips = [0, 1, 2].map(i => `<span class="${cleared(c, i) ? 'on' : ''}">★</span>`).join('');
      return `${flag}<a class="node ${done ? 'done' : open ? (cur ? 'cur' : 'open') : 'locked'}" style="--dx:${DX[k++ % DX.length]}%" href="#c-${c.id}" ${open ? '' : 'aria-disabled="true"'}>
        <span class="orb"><span class="m">${m[0]}</span>${done ? `<span class="badge">${c.item[0]}</span>` : ''}</span>
        <span class="lab"><small>${esc(c.title)}</small><b>${open ? esc(m[1]) : '???'}</b><span class="pips" aria-label="3단계 중 ${[0, 1, 2].filter(i => cleared(c, i)).length}단계 승리">${pips}</span></span></a>`;
    }).join('');
    const bo = bossOpen(g), bw = bossWon(g);
    const boss = `<button type="button" class="node boss ${bw ? 'done' : bo ? 'cur' : 'locked'}" style="--dx:${DX[k % DX.length]}%" id="boss">
      <span class="orb"><span class="m">${W.boss[0]}</span>${bw ? '<span class="badge">🏆</span>' : ''}</span>
      <span class="lab"><small>${W.name}의 보스 · 10연속 전투</small><b>${bo ? W.boss[1] : '???'}</b><span class="pips">${bw ? `격파! 최고 ${S.boss[g]}/10` : bo ? (S.boss[g] ? `최고 ${S.boss[g]}/10` : '도전 가능') : '모든 몬스터를 1단계 이상 이기면 열림'}</span></span></button>`;
    const quests = QUESTS.map((q, i) => {
      const v = Math.min(d[q[0]], q[2]), full = v >= q[2];
      return `<div class="quest"><div><b>${q[1]}</b><div class="qbar"><i style="width:${v / q[2] * 100}%"></i></div></div>
        <button class="btn small ${full && !d.got[i] ? 'primary' : ''}" type="button" data-q="${i}" ${full && !d.got[i] ? '' : 'disabled'}>${d.got[i] ? '완료 ✓' : full ? `받기 🪙${q[3]}` : `${v}/${q[2]} · 🪙${q[3]}`}</button></div>`;
    }).join('');
    app.innerHTML = `<section class="home-head"><h1>수학 원정대</h1><p>몬스터를 물리치고 중학 수학 ${concepts.length}개 지역을 정복하라!</p></section>
      <div class="tabs" role="tablist">${[1, 2, 3].map(n => `<button class="tab" role="tab" type="button" data-g="${n}" aria-selected="${n === g}"><span>${bossWon(n) ? '🏆' : WORLD[n].icon}</span>${WORLD[n].name}<small>${GRADE[n]} · ${ofGrade(n).filter(mastered).length}/${ofGrade(n).length} 정복</small></button>`).join('')}</div>
      ${up ? `<div class="continue"><span class="foe">${monOf(up.c)[0]}</span><div><small>다음 상대 · ${esc(up.c.title)}</small><b>${esc(monName(up.c, up.i))}</b></div><button class="btn primary small" type="button" id="go">⚔️ 전투</button></div>`
        : `<div class="continue"><span class="foe">🏆</span><div><small>${W.name}</small><b>모든 몬스터를 정복했다!</b></div><span></span></div>`}
      <section class="sheet"><h2>오늘의 임무</h2><div class="quests">${quests}</div></section>
      <div class="map" id="map"><svg class="trail" aria-hidden="true"><path/></svg>${nodes}${boss}</div>
      <p class="foot">게임 기록은 이 기기의 브라우저에 저장됩니다.</p>`;
    $$('.tab', app).forEach(b => b.onclick = () => { S.grade = +b.dataset.g; save(); viewHome(); });
    if (up) $('#go').onclick = () => startStage(up.c, up.i);
    $$('[data-q]', app).forEach(b => b.onclick = () => { const i = +b.dataset.q; if (d.got[i]) return; d.got[i] = 1; S.gold += QUESTS[i][3]; save(); sfx.coin(); drawHud(`+${QUESTS[i][3]} 🪙`); viewHome(); });
    $$('a.node.locked', app).forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('앞의 몬스터를 먼저 이겨야 한다!'); }));
    $('#boss').onclick = () => bo ? startBoss(g) : toast('모든 몬스터를 1단계 이상 이기면 보스가 나타난다!');
    drawTrail();
  }
  function drawTrail() {
    const map = $('#map'); if (!map) return;
    const pts = $$('.orb', map).map(o => { const n = o.parentElement; return [n.offsetLeft + o.offsetLeft + o.offsetWidth / 2, n.offsetTop + o.offsetTop + o.offsetHeight / 2]; });
    if (!pts.length) return;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2; d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`; }
    $('.trail path', map).setAttribute('d', d);
  }
  addEventListener('resize', drawTrail);

  /* ───── 몬스터 정보(개념) ───── */
  let dungeonLv = 3;   // 0~2: 고정 난이도, 3: 내려갈수록 어려워짐
  const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  function viewConcept(c) {
    if (!cOpen(c)) { location.hash = 'home'; return; }
    const done = mastered(c), b = S.bank[c.id] || { n: 0, c: 0, best: 0 }, m = monOf(c);
    const stages = [0, 1, 2].map(i => {
      const open = sOpen(c, i), n = best(c, i), st = starsOf(n);
      return `<div class="stage ${open ? '' : 'locked'}"><span class="mon">${m[0]}</span>
        <div><b>${open ? esc(monName(c, i)) : '???'}</b><span class="stars" aria-label="별 ${st}개">${[1, 2, 3].map(k => `<span class="${k <= st ? 'on' : ''}">★</span>`).join('')}</span>
        <small> ${i + 1}단계 ${STAGE[i]}${n ? ` · 최고 ${n}/5` : open ? '' : ` · ${i}단계 승리 후 등장`}</small></div>
        <button class="btn small ${open && !cleared(c, i) ? 'primary' : ''}" type="button" data-s="${i}" ${open ? '' : 'disabled'}>${cleared(c, i) ? '재대결' : '⚔️ 전투'}</button></div>`;
    }).join('');
    app.innerHTML = `<a class="linkbtn back" href="#home">← 지도로</a>
      <header class="c-head"><span class="orb">${m[0]}</span><div><span class="eyebrow">${WORLD[c.g].name} · ${esc(c.unit)}</span><h1>${esc(m[1])}</h1><p>약점: ${esc(c.title)}</p></div></header>
      <section class="sheet"><h2>📖 공략집 — ${esc(c.title)}</h2><ul class="pts">${c.pts.map(p => `<li>${p}</li>`).join('')}</ul></section>
      <section class="video"><p><b>공략집만으로 부족하다면?</b> 정승제 선생님 강의에서 이 개념을 찾아보세요. 유튜브 검색 결과가 새 창으로 열립니다.</p>
        <div class="row"><a class="btn small red" href="${yt('정승제 ' + c.yt)}" target="_blank" rel="noopener">▶ 정승제 「${esc(c.title)}」 강의</a>
        <a class="btn small" href="${yt('정승제 50일 수학 ' + c.yt)}" target="_blank" rel="noopener">50일 수학에서 찾기</a></div></section>
      <section><h2 style="margin-bottom:10px">⚔️ 전투 (5문제 · 하트 2개)</h2><div class="stages">${stages}</div><p class="muted">정답이면 공격, 오답이면 반격당해 하트를 잃습니다. 4문제 이상 맞히면 승리!</p></section>
      <div class="reward ${done ? '' : 'no'}"><span class="ic">${c.item[0]}</span><div>${done ? `<b>${esc(c.item[1])}</b> 획득! 내 캐릭터 화면에서 무기로 장착할 수 있다.` : josa(`3단계를 모두 이기면 무기 <b>${esc(c.item[1])}</b>을(를) 얻는다.`)}</div></div>
      <section class="sheet"><h2>🕳️ 무한 던전 (문제은행)</h2>
        <div class="seg" role="group" aria-label="난이도">${['1단계', '2단계', '3단계', '점점 강하게'].map((t, i) => `<button type="button" data-b="${i}" aria-pressed="${i === dungeonLv}">${t}</button>`).join('')}</div>
        <button class="btn wide" type="button" id="dungeon">던전 입장 (하트 3개)</button>
        <p class="muted">몬스터가 끝없이 나옵니다. 하트가 다 떨어질 때까지 몇 층이나 내려갈 수 있을까?${b.best ? ` 최고 기록 지하 ${b.best}층.` : ''}${b.n ? ` 지금까지 ${b.n}문제, 정답률 ${Math.round(b.c / b.n * 100)}%.` : ''}</p></section>`;
    $$('[data-s]', app).forEach(x => x.onclick = () => startStage(c, +x.dataset.s));
    $$('[data-b]', app).forEach(x => x.onclick = () => { dungeonLv = +x.dataset.b; $$('[data-b]', app).forEach(y => y.setAttribute('aria-pressed', y === x)); });
    $('#dungeon').onclick = () => startDungeon(c, dungeonLv);
  }

  /* ───── 전투 ───── */
  let B = null;
  const later = (ms, fn) => { const b = B; setTimeout(() => { if (B === b && b) fn(); }, ms); };
  function startStage(c, i) {
    if (!sOpen(c, i)) return;
    const set = makeSet(c.L[i], 5); set.forEach(p => { p.c = c; p.lv = i; });
    begin({ kind: 'stage', c, i, set, rounds: 5, hearts: 2, foe: [monOf(c)[0], monName(c, i)], tier: i, world: c.g, sub: `${i + 1}단계 · ${c.title}` });
  }
  function startBoss(g) {
    if (!bossOpen(g)) return;
    const cs = shuf(ofGrade(g)), set = [];
    for (let k = 0; k < 10; k++) { const c = cs[k % cs.length], lv = k < 7 ? 1 : 2, p = make(c.L[lv]); p.c = c; p.lv = lv; set.push(p); }
    begin({ kind: 'boss', g, set, rounds: 10, hearts: 3, foe: WORLD[g].boss, tier: 3, world: g, sub: `${WORLD[g].name} 보스전` });
  }
  function startDungeon(c, lv) {
    begin({ kind: 'dungeon', c, lv, set: [], rounds: Infinity, hearts: 3, world: c.g, sub: `무한 던전 · ${c.title}` });
  }
  function dungeonFloor() {       // 새 층: 몬스터와 문제를 새로 만든다
    const f = B.ok + 1, depth = Math.min(2, Math.floor((f - 1) / 3)), lv = B.lv < 3 ? B.lv : depth;
    if (!B.foe || B.newFoe) { const m = monOf(P(ofGrade(B.c.g))); B.foe = [m[0], TIER[depth] + m[1]]; B.tier = depth; B.newFoe = false; B.spawn = true; }
    const p = make(B.c.L[lv]); p.c = B.c; p.lv = lv; return p;
  }
  function begin(o) {
    B = Object.assign({ k: 0, ok: 0, combo: 0, maxCombo: 0, gold: 0, xp: 0, fast: 0, maxHearts: o.hearts }, o);
    document.body.classList.add('in-battle');
    app.innerHTML = `<div class="b-top"><button class="x" type="button" id="quit" aria-label="전투 그만두기">✕</button>
        <div class="b-title"><small>${esc(B.sub)}</small><b id="foeName"></b></div>
        <button class="hintbtn" type="button" id="hint" aria-label="힌트 사용">🔍 <b id="hintN">${S.hints}</b></button></div>
      <section class="arena w${B.world}" id="arena" aria-label="전장">
        <div class="fighter hero"><div class="hearts" id="hearts"></div><div class="sprite" id="heroS">${S.skin}</div></div>
        <div class="combo" id="combo" aria-live="polite"></div>
        <div class="fighter foe"><div class="hpbar" id="hp"></div><div class="sprite mon" id="monS"></div></div>
      </section>
      <div class="timer" id="timer" title="스피드 보너스 시간"></div><div id="qa"></div>`;
    const quit = $('#quit');
    quit.onclick = () => {
      if (B.kind === 'dungeon') return finish(true);
      if (B.k === 0 && !B.answered || quit.classList.contains('sure')) { const h = B.c ? 'c-' + B.c.id : 'home'; B = null; if (location.hash === '#' + h) route(); else location.hash = h; showLevelUp(); }
      else { quit.classList.add('sure'); quit.textContent = '도망칠까?'; setTimeout(() => { if (quit.isConnected) { quit.classList.remove('sure'); quit.textContent = '✕'; } }, 2500); }
    };
    $('#hint').onclick = useHint;
    showQ();
  }
  function drawArena() {
    $('#hearts').textContent = '❤️'.repeat(Math.max(B.hearts, 0)) + '🖤'.repeat(B.maxHearts - Math.max(B.hearts, 0));
    const hp = $('#hp');
    if (B.kind === 'dungeon') { hp.className = 'hpbar floor'; hp.textContent = `지하 ${B.ok + 1}층`; }
    else hp.innerHTML = Array.from({ length: B.rounds }, (_, j) => `<i class="${j < B.rounds - B.ok ? '' : 'off'}"></i>`).join('');
    $('#combo').innerHTML = B.combo >= 2 ? `${B.combo}<br>COMBO` : '';
    $('#foeName').textContent = B.foe[1];
  }
  function showQ() {
    const p = B.p = B.kind === 'dungeon' ? dungeonFloor() : B.set[B.k];
    B.answered = false; B.input = ''; B.hinted = false; B.t0 = performance.now(); B.limit = LIMIT[p.lv];
    const mon = $('#monS');
    if (B.kind !== 'dungeon' ? B.k === 0 : B.spawn) { mon.className = `sprite mon t${B.tier} spawn`; mon.textContent = B.foe[0]; B.spawn = false; }
    drawArena();
    const tm = $('#timer'); tm.className = 'timer'; tm.innerHTML = `<i style="animation-duration:${B.limit}s"></i>`;
    const two = p.t === 'mc' && p.opts.every(o => plain(o).length <= 13 && !o.includes('class="fr"') || plain(o).length <= 8);
    const where = B.kind === 'dungeon' ? `지하 ${B.ok + 1}층` : `${B.k + 1} / ${B.rounds}`;
    const body = p.t === 'mc'
      ? `<div class="opts ${two ? 'two' : ''}" id="opts">${p.opts.map((o, j) => `<button class="opt" type="button" data-o="${j}">${o}</button>`).join('')}</div>`
      : `<div class="field" id="field" aria-live="polite">${p.pre ? `<small>${p.pre}</small>` : ''}<span class="val" id="val"></span>${p.u ? `<small>${p.u}</small>` : ''}</div><div id="hintrow"></div>
         <div class="pad" id="pad">${['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', '/', '0', '.'].map(kc => `<button class="key ${/\d/.test(kc) ? '' : 'fn'}" type="button" data-k="${kc}" aria-label="${{ '⌫': '지우기', '−': '음수 부호', '/': '분수 표시', '.': '소수점' }[kc] || kc}">${kc === '⌫' ? '←' : kc}</button>`).join('')}<button class="key go" type="button" data-k="ok">⚔️ 공격</button></div>`;
    $('#qa').innerHTML = `<section class="qcard"><div class="eyebrow"><span>${esc(p.c.title)}</span><span>${where}</span></div><div class="q">${p.q}</div></section>${body}<div id="fb"></div>`;
    scrollTo(0, 0);
    if (p.t === 'mc') $$('.opt', app).forEach(b => b.onclick = () => { if (!b.disabled) resolve(+b.dataset.o === p.a, +b.dataset.o); });
    else $('#pad').onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  }
  function press(kc) {
    if (!B || B.answered) return;
    if (kc === 'ok') { if (B.input) resolve(check(B.p, B.input)); else toast('답을 입력하고 공격!'); return; }
    if (kc === '⌫') B.input = B.input.slice(0, -1);
    else if (kc === '−') B.input = B.input.startsWith('−') ? B.input.slice(1) : '−' + B.input;
    else if (kc === '/') { if (B.input && !/[/.]$/.test(B.input) && !B.input.includes('/') && B.input !== '−') B.input += '/'; }
    else if (kc === '.') { const last = B.input.split('/').pop(); if (/\d$/.test(B.input) && !last.includes('.')) B.input += '.'; }
    else if (B.input.replace(/\D/g, '').length < 9) B.input += kc;
    $('#val').textContent = B.input;
  }
  function useHint() {
    if (!B || B.answered || B.hinted) return;
    if (S.hints <= 0) return toast('힌트가 없다. 상점에서 살 수 있다!');
    const p = B.p; B.hinted = true; S.hints--; save(); $('#hintN').textContent = S.hints;
    if (p.t === 'mc') shuf(p.opts.map((_, j) => j).filter(j => j !== p.a)).slice(0, p.opts.length - 2).forEach(j => { $(`.opt[data-o="${j}"]`).disabled = true; });
    else {
      const { n, d } = p.a, seen = new Set([p.aH]), out = [p.aH];
      for (const [a, b] of shuf([[n + d, d], [n - d, d], [-n, d], [2 * n, d], [n + 2 * d, d], [n, 2 * d], [n - 2 * d, d], [10 * n, d], [n + 3 * d, d]])) { const h = fr(a, b); if (!seen.has(h)) { seen.add(h); out.push(h); } if (out.length === 4) break; }
      $('#hintrow').innerHTML = `<div class="hintrow">${shuf(out).map(h => `<button type="button" data-h="${esc(h)}">${h}</button>`).join('')}</div>`;
      $$('[data-h]', app).forEach(b => b.onclick = () => { $('#val').innerHTML = b.innerHTML; resolve(b.dataset.h === p.aH); });
    }
    toast('힌트 사용! 보기가 줄었다');
  }
  addEventListener('keydown', e => {
    if (!overlay.hidden) { if (e.key === 'Enter' || e.key === 'Escape') { const b = $('#lv-ok'); if (b) b.click(); e.preventDefault(); } return; }
    if (!B || e.metaKey || e.ctrlKey || e.altKey) return;
    const p = B.p;
    if (B.answered) { if (e.key === 'Enter') { const n = $('#next'); if (n) { e.preventDefault(); n.click(); } } return; }
    if (p.t === 'num') { const m = { Backspace: '⌫', '-': '−', Enter: 'ok' }[e.key] || (/^[0-9/.]$/.test(e.key) ? e.key : null); if (m) { e.preventDefault(); press(m); } }
    else if (/^[1-4]$/.test(e.key) && +e.key <= p.opts.length) { const b = $(`.opt[data-o="${+e.key - 1}"]`); if (b && !b.disabled) b.click(); }
  });

  function resolve(ok, picked) {
    if (!B || B.answered) return;
    B.answered = true;
    const p = B.p, fast = ok && (performance.now() - B.t0) / 1000 < B.limit, dq = daily(), arena = $('#arena'), mon = $('#monS'), hero = $('#heroS');
    $('#timer').classList.add('stop');
    touchStreak(); S.solved++;
    let xp = 0, gold = 0, crit = false;
    if (ok) {
      S.correct++; B.ok++; B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo); crit = B.combo >= 3;
      xp = B.kind === 'dungeon' ? 5 : 10; gold = 5 + (fast ? 3 : 0) + (crit ? 2 : 0); if (fast) B.fast++;
      dq.ok++; dq.combo = Math.max(dq.combo, B.combo);
    } else { B.combo = 0; B.hearts--; }
    if (B.kind === 'dungeon') { const b = S.bank[B.c.id] || (S.bank[B.c.id] = { n: 0, c: 0, best: 0 }); b.n++; if (ok) { b.c++; b.best = Math.max(b.best || 0, B.ok); B.newFoe = true; } }
    B.xp += xp; B.gold += gold; S.gold += gold; save();
    if (p.t === 'mc') $$('.opt', app).forEach((b, j) => { b.disabled = true; if (j === p.a) b.classList.add('right'); else if (j === picked) b.classList.add('wrong'); });
    else { $('#field').classList.add(ok ? 'right' : 'wrong'); $('#pad').hidden = true; $('#hintrow').innerHTML = ''; }
    const dead = B.hearts <= 0, lastRound = B.kind !== 'dungeon' && B.k === B.rounds - 1, over = dead || lastRound;
    // 전장 연출
    if (ok) {
      const w = weapon()[0], dmg = (100 + R(0, 35)) * (crit ? 2 : 1);
      arena.insertAdjacentHTML('beforeend', `<span class="shot ${crit ? 'crit' : ''}">${w}</span>`);
      crit ? sfx.crit() : sfx.hit();
      later(280, () => {
        const s = $('.shot', arena); if (s) s.remove();
        mon.classList.remove('spawn', 'hit'); void mon.offsetWidth; mon.classList.add('hit');
        arena.insertAdjacentHTML('beforeend', `<span class="dmg ${crit ? 'crit' : ''}">${crit ? 'CRITICAL ' : ''}${dmg}</span>`);
        drawArena(); const cb = $('#combo'); cb.classList.remove('bump'); void cb.offsetWidth; cb.classList.add('bump'); buzz(crit ? [20, 30, 40] : 20);
        if (B.kind === 'dungeon' || (lastRound && B.ok === B.rounds)) later(380, () => { mon.className = `sprite mon t${B.tier} die`; });
        else if (lastRound) later(380, () => { mon.className = `sprite mon t${B.tier} flee`; });
      });
    } else {
      mon.classList.remove('spawn', 'hit'); void mon.offsetWidth; mon.classList.add('lunge'); sfx.miss();
      later(170, () => {
        hero.classList.add('hurt'); arena.classList.add('flash'); buzz(120);
        arena.insertAdjacentHTML('beforeend', '<span class="dmg me">💔</span>'); drawArena();
        later(450, () => { mon.classList.remove('lunge'); hero.classList.remove('hurt'); arena.classList.remove('flash'); if (dead) hero.classList.add('down'); else if (lastRound) mon.className = `sprite mon t${B.tier} flee`; });
      });
    }
    later(900, () => $$('.dmg', arena).forEach(x => x.remove()));
    // 결과 카드
    later(ok ? 420 : 520, () => {
      const tags = ok ? `<span class="tag">+${xp} XP</span><span class="tag">+${gold} 🪙</span>${fast ? '<span class="tag sky">⚡ 스피드</span>' : ''}${crit ? `<span class="tag crit">${B.combo} COMBO</span>` : ''}` : '';
      $('#fb').innerHTML = `<div class="fb ${ok ? '' : 'no'}" role="status"><h3>${ok ? (crit ? '크리티컬 명중!' : '명중!') : dead ? '쓰러졌다…' : '반격당했다!'}</h3>${tags ? `<div class="tags">${tags}</div>` : ''}
        ${ok ? (p.exp ? `<details><summary>풀이 보기</summary><div class="exp">${p.exp}</div></details>` : '')
          : `<div class="ans">정답: <b>${p.pre ? p.pre + ' ' : ''}${p.aH}${p.u ? ' ' + p.u : ''}</b></div>${p.exp ? `<div class="exp">${p.exp}</div>` : ''}
             <a class="linkbtn" href="${yt('정승제 ' + p.c.yt)}" target="_blank" rel="noopener">▶ 정승제 선생님 강의로 복습하기</a>`}
        <button class="btn primary wide" type="button" id="next">${over ? '결과 보기' : B.kind === 'dungeon' ? (ok ? '다음 층으로 ▶' : '다시 덤비기 ▶') : '다음 공격 ▶'}</button></div>`;
      if (xp) addXp(xp);
      const nx = $('#next');
      nx.onclick = () => { if (over) return finish(); if (B.kind !== 'dungeon') B.k++; showQ(); showLevelUp(); };
      nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }

  function finish(escaped) {
    const b = B, dq = daily(), rows = [], n = b.ok;
    let title, sub, win = false, stars = -1, got = null, bonusXp = 0, bonusGold = 0, scene, actions;
    rows.push([`명중 ${n}번`, `+${b.xp} XP · +${b.gold} 🪙`]);
    if (b.kind === 'stage') {
      const { c, i } = b, before = best(c, i), wasMaster = mastered(c);
      win = n >= 4; stars = starsOf(n);
      if (n > before) { const a = S.st[c.id] || (S.st[c.id] = [0, 0, 0]); a[i] = n; }
      if (win) { bonusGold += 20; rows.push(['승리 보상', '+20 🪙']); }
      if (win && before < 4) { bonusXp += 30; rows.push(['첫 승리 보너스', '+30 XP']); }
      if (n === 5) { bonusGold += 15; rows.push(['퍼펙트 보상', '+15 🪙']); if (before < 5) { bonusXp += 20; rows.push(['첫 퍼펙트 보너스', '+20 XP']); } }
      if (mastered(c) && !wasMaster) { got = c; bonusXp += 100; rows.push([`「${c.title}」 정복`, '+100 XP']); if (!S.weapon) S.weapon = c.id; }
      title = n === 5 ? 'PERFECT!' : win ? 'VICTORY!' : 'DEFEAT';
      sub = n === 5 ? josa(`${b.foe[1]}을(를) 완벽하게 쓰러뜨렸다!`) : win ? josa(`${b.foe[1]}이(가) 도망쳤다! 다음엔 한 번도 맞지 말고 쓰러뜨리자.`) : `${b.foe[1]}에게 당했다. 공략집을 다시 읽고 재도전!`;
      const nx = nextOf(c);
      actions = `${win && i < 2 ? `<button class="btn primary wide" type="button" id="r-next">⚔️ 다음 상대: ${esc(monName(c, i + 1))}</button>` : ''}
        ${win && i === 2 && nx ? `<a class="btn primary wide" href="#c-${nx.id}">다음 지역: ${esc(monOf(nx)[1])}</a>` : ''}
        <button class="btn wide ${win ? '' : 'primary'}" type="button" id="r-again">${win ? (n === 5 ? '재대결' : '퍼펙트에 재도전') : '⚔️ 재도전'}</button>
        <a class="btn wide" href="#c-${c.id}">${win ? '몬스터 정보로' : '📖 공략집 다시 읽기'}</a>`;
    } else if (b.kind === 'boss') {
      const first = !bossWon(b.g); win = b.hearts > 0;
      S.boss[b.g] = Math.max(S.boss[b.g] || 0, n);
      if (win) { bonusGold += 60; rows.push(['보스 격파 보상', '+60 🪙']); if (first) { bonusXp += 300; bonusGold += 200; rows.push(['첫 격파 보너스', '+300 XP · +200 🪙']); } }
      title = win ? (n === 10 ? 'PERFECT!' : 'BOSS CLEAR!') : 'DEFEAT';
      sub = win ? josa(`${WORLD[b.g].name}의 보스 ${b.foe[1]}을(를) 물리쳤다!`) : `${b.foe[1]}의 벽은 높았다. 10문제 중 ${n}번 명중.`;
      actions = `<button class="btn wide ${win ? '' : 'primary'}" type="button" id="r-again">${win ? '보스 재대결' : '⚔️ 재도전'}</button><a class="btn wide ${win ? 'primary' : ''}" href="#home">지도로</a>`;
    } else {
      win = n >= 5;
      title = `지하 ${n + 1}층`; sub = n ? `몬스터 ${n}마리를 물리치고 ${escaped ? '탈출했다' : '쓰러졌다'}. 최고 기록 지하 ${(S.bank[b.c.id] || {}).best || n}층.` : '첫 층에서 물러났다. 다시 도전!';
      if (n >= 10) { bonusGold += 30; rows.push(['10층 돌파 보상', '+30 🪙']); }
      actions = `<button class="btn primary wide" type="button" id="r-again">🕳️ 다시 입장</button><a class="btn wide" href="#c-${b.c.id}">몬스터 정보로</a>`;
    }
    if (win && b.kind !== 'dungeon') dq.win++;
    S.gold += bonusGold; save();
    if (bonusXp) addXp(bonusXp); else drawHud();
    const lost = b.kind !== 'dungeon' && !win;
    scene = `<span class="${lost || (b.kind === 'dungeon' && !escaped) ? 'gone' : ''}">${S.skin}</span><span>${lost ? b.foe[0] : b.kind === 'dungeon' ? '🕳️' : n === b.rounds ? '💥' : '💨'}</span>`;
    B = null; document.body.classList.remove('in-battle');
    app.innerHTML = `<section class="result">
      <span class="eyebrow">${esc(b.sub)}</span>
      <div class="banner ${lost ? 'lose' : ''}">${title}</div><p class="sub">${sub}</p>
      <div class="scene" aria-hidden="true">${scene}</div>
      ${stars >= 0 ? `<div class="bigstars" aria-label="별 ${stars}개">${[1, 2, 3].map(k => `<span class="${k <= stars ? 'on' : ''}">★</span>`).join('')}</div>` : ''}
      ${got ? `<div class="loot"><span class="ic">${got.item[0]}</span><div><small>새 무기 획득!</small><b>${esc(got.item[1])}</b>「${esc(got.title)}」 지역을 정복한 증표. 내 캐릭터 화면에서 장착할 수 있다.</div></div>` : ''}
      <div class="sheet tally">${rows.map(r => `<div><span>${esc(r[0])}</span><span>${r[1]}</span></div>`).join('')}
        <div class="sum"><span>최대 콤보 ${b.maxCombo} · 스피드 ${b.fast}번</span><span>+${b.xp + bonusXp} XP · +${b.gold + bonusGold} 🪙</span></div></div>
      <div class="actions">${actions}</div></section>`;
    scrollTo(0, 0);
    if ($('#r-next')) $('#r-next').onclick = () => startStage(b.c, b.i + 1);
    $('#r-again').onclick = () => b.kind === 'stage' ? startStage(b.c, b.i) : b.kind === 'boss' ? startBoss(b.g) : startDungeon(b.c, b.lv);
    if (!lost && n) { confetti(got || b.kind === 'boss' ? 140 : n === b.rounds ? 90 : 50); sfx.win(); } else sfx.lose();
    setTimeout(showLevelUp, lost ? 300 : 900);
  }

  /* ───── 내 캐릭터 ───── */
  function viewMe() {
    const L = levelOf(S.xp), me = rankOf(L.lv), w = weapon(), stars = concepts.reduce((s, c) => s + [0, 1, 2].reduce((a, i) => a + starsOf(best(c, i)), 0), 0);
    const owned = concepts.filter(mastered);
    app.innerHTML = `<a class="linkbtn back" href="#home">← 지도로</a>
      <header class="herocard"><div class="fig2">${S.skin}<span>${w[0]}</span></div><div><span class="eyebrow">내 캐릭터</span><h1>Lv.${L.lv} ${me[2]}</h1><p>무기: ${esc(w[1])} · 🪙 ${S.gold} · 🔍 힌트 ${S.hints}개</p></div></header>
      <div class="stats"><div class="stat"><b>${stars} / ${concepts.length * 9}</b><small>모은 별</small></div><div class="stat"><b>${owned.length} / ${concepts.length}</b><small>정복한 지역</small></div>
        <div class="stat"><b>${S.solved}</b><small>공격 횟수(푼 문제)</small></div><div class="stat"><b>${S.solved ? Math.round(S.correct / S.solved * 100) + '%' : '–'}</b><small>명중률</small></div></div>
      <section><h2 style="margin-bottom:8px">무기 선택</h2><div class="items">
        <button type="button" class="item on" data-w="" aria-pressed="${w[0] === '✏️'}"><span>✏️</span><b>연필</b>기본 무기</button>
        ${concepts.map(c => mastered(c)
          ? `<button type="button" class="item on" data-w="${c.id}" aria-pressed="${S.weapon === c.id}"><span>${c.item[0]}</span><b>${esc(c.item[1])}</b>${esc(monOf(c)[1])}</button>`
          : `<a class="item" href="#c-${c.id}" ${cOpen(c) ? '' : 'aria-disabled="true"'}><span>${c.item[0]}</span><b>???</b>${esc(c.title)}</a>`).join('')}</div>
        <p class="muted">몬스터의 3단계를 모두 이기면 그 지역의 무기를 얻습니다.</p></section>
      <section><h2 style="margin-bottom:8px">캐릭터 선택</h2><div class="items">${SKINS.map(s => S.skins.includes(s[0])
        ? `<button type="button" class="item on" data-skin="${s[0]}" aria-pressed="${S.skin === s[0]}"><span>${s[0]}</span><b>${s[1]}</b>보유 중</button>`
        : `<a class="item" href="#shop"><span>${s[0]}</span><b>${s[1]}</b><small>🪙 ${s[2]}</small></a>`).join('')}</div></section>
      <section><h2 style="margin-bottom:8px">칭호</h2><div class="ranks">${RANKS.map(r => `<div class="rank ${L.lv >= r[0] ? 'on' : ''} ${r === me ? 'me' : ''}"><span>${r[1]}</span>${r[2]}<br>Lv.${r[0]}</div>`).join('')}</div></section>
      <section class="sheet"><h2>설정</h2>
        <div class="setting"><p>효과음<small>공격, 승리 소리를 켜거나 끕니다.</small></p><button class="btn small ${S.mute ? '' : 'primary'}" type="button" id="mute" aria-pressed="${!S.mute}">${S.mute ? '꺼짐' : '켜짐'}</button></div>
        <div class="setting"><p>자유 모드<small>잠금을 풀어 모든 몬스터와 바로 싸울 수 있습니다.</small></p><button class="btn small ${S.free ? 'primary' : ''}" type="button" id="free" aria-pressed="${S.free}">${S.free ? '켜짐' : '꺼짐'}</button></div>
        <div class="setting"><p>기록 초기화<small>레벨, 골드, 별, 무기가 모두 지워집니다.</small></p><button class="btn small" type="button" id="reset">초기화</button></div></section>`;
    $$('[data-w]', app).forEach(b => b.onclick = () => { S.weapon = b.dataset.w; save(); sfx.hit(); viewMe(); });
    $$('[data-skin]', app).forEach(b => b.onclick = () => { S.skin = b.dataset.skin; save(); drawHud(); viewMe(); });
    $('#mute').onclick = () => { S.mute = !S.mute; save(); sfx.coin(); viewMe(); };
    $('#free').onclick = () => { S.free = !S.free; save(); viewMe(); };
    const rs = $('#reset');
    rs.onclick = () => {
      if (rs.dataset.sure) { S = fresh(); save(); drawHud(); location.hash = 'home'; route(); toast('기록을 초기화했습니다'); }
      else { rs.dataset.sure = '1'; rs.textContent = '정말 지울까요?'; rs.classList.add('red'); setTimeout(() => { if (rs.isConnected) { delete rs.dataset.sure; rs.textContent = '초기화'; rs.classList.remove('red'); } }, 3000); }
    };
    $$('a.item[aria-disabled]', app).forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('아직 만나지 못한 몬스터의 무기다'); }));
  }

  /* ───── 상점 ───── */
  function viewShop() {
    const buy = (cost, fn) => { if (S.gold < cost) return toast(`골드가 ${cost - S.gold}만큼 부족하다. 전투에서 벌어 오자!`); S.gold -= cost; fn(); save(); sfx.coin(); drawHud(); viewShop(); };
    app.innerHTML = `<a class="linkbtn back" href="#home">← 지도로</a>
      <header class="herocard"><div class="fig2">🏪</div><div><span class="eyebrow">상점</span><h1>🪙 ${S.gold}</h1><p>전투에서 이기고, 빨리 맞히고, 콤보를 이으면 골드를 얻습니다.</p></div></header>
      <section><h2 style="margin-bottom:8px">아이템</h2><div class="items">
        <button type="button" class="item on" data-buy="h1"><span>🔍</span><b>힌트 돋보기</b>보기를 줄여 준다 · 보유 ${S.hints}<small>🪙 40</small></button>
        <button type="button" class="item on" data-buy="h3"><span>🔍</span><b>돋보기 3개 묶음</b>조금 더 싸다<small>🪙 100</small></button></div></section>
      <section><h2 style="margin-bottom:8px">캐릭터</h2><div class="items">${SKINS.map(s => S.skins.includes(s[0])
        ? `<button type="button" class="item on" data-skin="${s[0]}" aria-pressed="${S.skin === s[0]}"><span>${s[0]}</span><b>${s[1]}</b>${S.skin === s[0] ? '사용 중' : '보유 중 · 눌러서 변경'}</button>`
        : `<button type="button" class="item on" data-buyskin="${s[0]}"><span>${s[0]}</span><b>${s[1]}</b><small>🪙 ${s[2]}</small></button>`).join('')}</div></section>`;
    $('[data-buy="h1"]').onclick = () => buy(40, () => { S.hints += 1; });
    $('[data-buy="h3"]').onclick = () => buy(100, () => { S.hints += 3; });
    $$('[data-buyskin]', app).forEach(b => b.onclick = () => { const s = SKINS.find(x => x[0] === b.dataset.buyskin); buy(s[2], () => { S.skins.push(s[0]); S.skin = s[0]; }); });
    $$('[data-skin]', app).forEach(b => b.onclick = () => { S.skin = b.dataset.skin; save(); drawHud(); viewShop(); });
  }

  /* ───── 화면 전환 ───── */
  function route() {
    B = null; document.body.classList.remove('in-battle');
    const h = location.hash.replace(/^#/, '');
    const c = h.startsWith('c-') && concepts.find(x => x.id === h.slice(2));
    if (c) { S.grade = c.g; viewConcept(c); }
    else if (h === 'me' || h === 'bag') viewMe();
    else if (h === 'shop') viewShop();
    else viewHome();
    scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  /* 주소(#)가 이미 같은 화면을 가리킬 때도 링크가 동작하도록 */
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a && !a.hasAttribute('aria-disabled') && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); } });
  drawHud(); route();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawTrail);
})();
