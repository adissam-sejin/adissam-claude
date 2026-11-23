/* 수학 원정대 — 화면과 게임 진행 */
(function () {
  'use strict';
  const { concepts, makeSet, make, check, shuf } = MQ;
  const $ = (s, el) => (el || document).querySelector(s);
  const app = $('#app'), hud = $('#hud'), overlay = $('#overlay');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  /* ───── 저장 ───── */
  const KEY = 'math-quest.v1';
  const fresh = () => ({ xp: 0, st: {}, bank: {}, streak: { d: '', n: 0 }, solved: 0, correct: 0, free: false, grade: 1 });
  let S = fresh();
  try { const r = JSON.parse(localStorage.getItem(KEY)); if (r && typeof r === 'object') S = Object.assign(fresh(), r); } catch (e) { /* 저장소를 쓸 수 없으면 새로 시작 */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* 무시 */ } };

  /* ───── 레벨과 칭호 ───── */
  const need = lv => 100 + 20 * (lv - 1);                     // lv → lv+1에 필요한 XP
  const levelOf = xp => { let lv = 1; while (xp >= need(lv)) { xp -= need(lv); lv++; } return { lv, cur: xp, max: need(lv) }; };
  const RANKS = [[1, '🌱', '수학 새싹'], [3, '🧭', '숫자 탐험가'], [6, '🗡️', '계산 검사'], [10, '🛡️', '방정식 기사'], [14, '🧙', '함수 마법사'], [18, '🦉', '도형 현자'], [22, '🦸', '수학 영웅'], [26, '👑', '수학 마스터'], [30, '🐉', '전설의 수학왕']];
  const rankOf = lv => RANKS.filter(r => lv >= r[0]).pop();
  const STAGE = ['개념 확인', '개념 적용', '실전 도전'];
  const GRADE = { 1: '중1', 2: '중2', 3: '중3' };

  /* ───── 진행 상태 ───── */
  const best = (c, i) => (S.st[c.id] || [0, 0, 0])[i] || 0;
  const cleared = (c, i) => best(c, i) >= 4;
  const starsOf = n => n >= 5 ? 3 : n === 4 ? 2 : n === 3 ? 1 : 0;
  const mastered = c => [0, 1, 2].every(i => cleared(c, i));
  const ofGrade = g => concepts.filter(c => c.g === g);
  const prevOf = c => { const l = ofGrade(c.g), i = l.indexOf(c); return i > 0 ? l[i - 1] : null; };
  const nextOf = c => { const l = ofGrade(c.g), i = l.indexOf(c); return l[i + 1] || null; };
  const cOpen = c => S.free || !prevOf(c) || cleared(prevOf(c), 0);
  const sOpen = (c, i) => cOpen(c) && (S.free || i === 0 || cleared(c, i - 1));
  const nextUp = g => { for (const c of ofGrade(g)) { if (!cOpen(c)) continue; for (let i = 0; i < 3; i++) if (!cleared(c, i) && sOpen(c, i)) return { c, i }; } return null; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };
  const touchStreak = () => {
    const t = today(); if (S.streak.d === t) return;
    const y = new Date(Date.now() - 864e5), ys = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`;
    S.streak = { d: t, n: S.streak.d === ys ? S.streak.n + 1 : 1 };
  };
  const streakNow = () => { const t = today(), y = new Date(Date.now() - 864e5), ys = `${y.getFullYear()}-${y.getMonth() + 1}-${y.getDate()}`; return (S.streak.d === t || S.streak.d === ys) ? S.streak.n : 0; };

  /* ───── 상태판 ───── */
  let pendingLv = null;
  function drawHud(pop) {
    const L = levelOf(S.xp), r = rankOf(L.lv), items = concepts.filter(mastered).length;
    hud.innerHTML = `<a class="avatar" href="#bag" aria-label="내 가방 열기">${r[1]}</a>
      <div class="hud-mid"><div class="hud-name"><span class="lv">Lv.${L.lv}</span><span>${r[2]}</span></div>
      <div class="xpbar" role="progressbar" aria-label="경험치" aria-valuemin="0" aria-valuemax="${L.max}" aria-valuenow="${L.cur}"><i style="width:${Math.round(L.cur / L.max * 100)}%"></i></div>
      <div class="xpnum">XP ${L.cur} / ${L.max}</div></div>
      <div class="hud-side"><span class="chip" title="연속 학습일"><b>🔥 ${streakNow()}</b>일째</span><a class="chip" href="#bag" title="모은 아이템"><b>🎒 ${items}</b>/${concepts.length}</a></div>
      ${pop ? `<span class="xp-pop">+${pop} XP</span>` : ''}`;
  }
  function addXp(n) {
    if (!n) return;
    const before = levelOf(S.xp).lv; S.xp += n; const after = levelOf(S.xp).lv;
    if (after > before) pendingLv = { from: pendingLv ? pendingLv.from : before, to: after };
    save(); drawHud(n);
  }
  function showLevelUp() {
    if (!pendingLv) return;
    const { from, to } = pendingLv; pendingLv = null;
    const r = rankOf(to), newRank = rankOf(from) !== r;
    overlay.innerHTML = `<div class="levelup" role="dialog" aria-modal="true" aria-label="레벨 업"><div class="big">${r[1]}</div><h2>LEVEL UP</h2><div class="num">Lv.${from} → Lv.${to}</div>
      <p>${newRank ? MQ.josa(`새 칭호 <b style="color:var(--yellow)">${r[2]}</b>을(를) 얻었습니다!`) : `${r[2]}, 계속 가 보자!`}</p>
      <button class="btn primary" id="lv-ok" type="button">계속하기</button></div>`;
    overlay.hidden = false; confetti(90);
    $('#lv-ok').focus();
    $('#lv-ok').onclick = () => { overlay.hidden = true; overlay.innerHTML = ''; };
  }

  /* ───── 색종이 ───── */
  const fx = $('#fx');
  function confetti(n) {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches || !fx.getContext) return;
    const ctx = fx.getContext('2d'), W = fx.width = innerWidth, H = fx.height = innerHeight;
    const col = ['#ffd23f', '#dd3a3f', '#2a68d8', '#178a5c', '#f2f6ea'];
    const ps = Array.from({ length: n }, () => ({ x: W / 2 + (Math.random() - .5) * W * .5, y: H * .35, vx: (Math.random() - .5) * 11, vy: -Math.random() * 11 - 3, s: 5 + Math.random() * 6, r: Math.random() * 6, c: col[Math.floor(Math.random() * col.length)] }));
    let t = 0;
    (function tick() {
      ctx.clearRect(0, 0, W, H);
      for (const p of ps) { p.vy += .32; p.x += p.vx; p.y += p.vy; p.r += .2; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * .66); ctx.restore(); }
      if (++t < 130) requestAnimationFrame(tick); else ctx.clearRect(0, 0, W, H);
    })();
  }

  /* ───── 지도 ───── */
  const DX = [0, 16, 30, 16, 0, 12, 26, 12];
  function viewHome() {
    const g = S.grade, list = ofGrade(g), up = nextUp(g);
    let unit = '', k = 0;
    const nodes = list.map(c => {
      const open = cOpen(c), done = mastered(c), cur = up && up.c === c;
      const flag = c.unit !== unit ? `<div class="unit-flag">${esc(unit = c.unit)}</div>` : '';
      const pips = [0, 1, 2].map(i => `<span class="${cleared(c, i) ? 'on' : ''}">★</span>`).join('');
      return `${flag}<a class="node ${done ? 'done' : open ? (cur ? 'cur' : 'open') : 'locked'}" style="--dx:${DX[k++ % DX.length]}%" href="#c-${c.id}" ${open ? '' : 'aria-disabled="true"'}>
        <span class="orb">${open ? c.icon : '🔒'}${done ? `<span class="badge">${c.item[0]}</span>` : ''}</span>
        <span class="lab"><b>${esc(c.title)}</b><span class="pips" aria-label="3단계 중 ${[0, 1, 2].filter(i => cleared(c, i)).length}단계 클리어">${pips}</span></span></a>`;
    }).join('');
    app.innerHTML = `<section class="home-head"><span class="eyebrow">고등학교 입학 전, 중학 수학 총정리</span><h1>수학 원정대</h1>
      <p>개념 ${concepts.length}개를 차례로 정복하세요. 한 개념은 3단계, 단계마다 5문제입니다. 4문제 이상 맞히면 다음 단계가 열립니다.</p></section>
      <div class="tabs" role="tablist">${[1, 2, 3].map(n => `<button class="tab" role="tab" type="button" data-g="${n}" aria-selected="${n === g}">${GRADE[n]} 과정<small>${ofGrade(n).filter(mastered).length} / ${ofGrade(n).length} 정복</small></button>`).join('')}</div>
      ${up ? `<div class="continue"><div><small>이어서 하기</small><b>${esc(up.c.title)} · ${up.i + 1}단계 ${STAGE[up.i]}</b></div><button class="btn primary small" type="button" id="go">도전</button></div>`
        : `<div class="continue"><div><small>${GRADE[g]} 과정</small><b>모든 개념을 정복했습니다!</b></div><span style="font-size:1.8rem">🏆</span></div>`}
      <div class="map" id="map"><svg class="trail" aria-hidden="true"><path/></svg>${nodes}</div>
      <p class="foot">학습 기록은 이 기기의 브라우저에 저장됩니다.</p>`;
    app.querySelectorAll('.tab').forEach(b => b.onclick = () => { S.grade = +b.dataset.g; save(); viewHome(); });
    if (up) $('#go').onclick = () => startStage(up.c, up.i);
    app.querySelectorAll('.node.locked').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('앞 개념의 1단계를 먼저 클리어하세요'); }));
    drawTrail();
  }
  function drawTrail() {
    const map = $('#map'); if (!map) return;
    const pts = [...map.querySelectorAll('.orb')].map(o => { const n = o.parentElement; return [n.offsetLeft + o.offsetLeft + o.offsetWidth / 2, n.offsetTop + o.offsetTop + o.offsetHeight / 2]; });
    if (!pts.length) return;
    let d = `M${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], my = (y0 + y1) / 2; d += ` C${x0} ${my} ${x1} ${my} ${x1} ${y1}`; }
    $('.trail path', map).setAttribute('d', d);
  }
  addEventListener('resize', drawTrail);
  let toastT;
  function toast(msg) {
    let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.setAttribute('role', 'status'); t.style.cssText = 'position:fixed;left:50%;bottom:calc(24px + env(safe-area-inset-bottom,0px));transform:translateX(-50%);z-index:20;max-width:calc(100% - 32px);padding:10px 16px;border-radius:12px;background:var(--board);color:var(--chalk);font-size:.92rem;text-align:center'; document.body.appendChild(t); }
    t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => { t.hidden = true; }, 2200);
  }

  /* ───── 개념 화면 ───── */
  let bankLevel = 3;   // 0~2: 단계, 3: 섞어서
  const yt = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q);
  function viewConcept(c) {
    if (!cOpen(c)) { location.hash = 'home'; return; }
    const done = mastered(c), b = S.bank[c.id] || { n: 0, c: 0 };
    const stages = [0, 1, 2].map(i => {
      const open = sOpen(c, i), n = best(c, i), st = starsOf(n);
      return `<div class="stage ${open ? '' : 'locked'}"><span class="no">${open ? i + 1 : '🔒'}</span>
        <div><b>${i + 1}단계 · ${STAGE[i]}</b><span class="stars" aria-label="별 ${st}개">${[1, 2, 3].map(k => `<span class="${k <= st ? 'on' : ''}">★</span>`).join('')}</span>
        <small> ${n ? `최고 ${n}/5` : open ? '5문제' : `${i}단계 클리어 후 열림`}</small></div>
        <button class="btn small ${open && !cleared(c, i) ? 'primary' : ''}" type="button" data-s="${i}" ${open ? '' : 'disabled'}>${cleared(c, i) ? '다시' : '시작'}</button></div>`;
    }).join('');
    app.innerHTML = `<a class="linkbtn back" href="#home">← 지도로</a>
      <header class="c-head"><span class="orb">${c.icon}</span><div><span class="eyebrow">${GRADE[c.g]} · ${esc(c.unit)}</span><h1>${esc(c.title)}</h1></div></header>
      <section class="sheet"><h2>마스터할 개념</h2><ul class="pts">${c.pts.map(p => `<li>${p}</li>`).join('')}</ul></section>
      <section class="video"><p><b>이해가 안 되는 부분이 있나요?</b> 정승제 선생님 강의에서 이 개념을 찾아보세요. 유튜브 검색 결과가 새 창으로 열립니다.</p>
        <div class="row"><a class="btn small red" href="${yt('정승제 ' + c.yt)}" target="_blank" rel="noopener">▶ 정승제 「${esc(c.title)}」 강의</a>
        <a class="btn small" href="${yt('정승제 50일 수학 ' + c.yt)}" target="_blank" rel="noopener">50일 수학에서 찾기</a></div></section>
      <section><h2 style="margin-bottom:10px">단계별 도전</h2><div class="stages">${stages}</div></section>
      <div class="reward ${done ? '' : 'no'}"><span class="ic">${c.item[0]}</span><div>${done ? `<b>${esc(c.item[1])}</b> 획득 완료! 가방에서 확인하세요.` : MQ.josa(`3단계를 모두 클리어하면 <b>${esc(c.item[1])}</b>을(를) 얻습니다.`)}</div></div>
      <section class="sheet"><h2>문제은행</h2>
        <div class="seg" role="group" aria-label="난이도">${['1단계', '2단계', '3단계', '섞어서'].map((t, i) => `<button type="button" data-b="${i}" aria-pressed="${i === bankLevel}">${t}</button>`).join('')}</div>
        <button class="btn wide" type="button" id="bank">문제 더 풀기</button>
        <p class="muted">매번 새로운 문제가 나옵니다. 원하는 만큼 풀 수 있고 맞힐 때마다 XP를 얻습니다.${b.n ? ` 지금까지 ${b.n}문제를 풀었고 정답률은 ${Math.round(b.c / b.n * 100)}%입니다.` : ''}</p></section>`;
    app.querySelectorAll('[data-s]').forEach(x => x.onclick = () => startStage(c, +x.dataset.s));
    app.querySelectorAll('[data-b]').forEach(x => x.onclick = () => { bankLevel = +x.dataset.b; app.querySelectorAll('[data-b]').forEach(y => y.setAttribute('aria-pressed', y === x)); });
    $('#bank').onclick = () => startBank(c, bankLevel);
  }

  /* ───── 문제 풀이 ───── */
  let Q = null;   // 진행 중인 풀이
  function startStage(c, i) {
    if (!sOpen(c, i)) return;
    Q = { mode: 'stage', c, i, set: makeSet(c.L[i], 5), k: 0, res: [], xp: 0 };
    showQ();
  }
  function startBank(c, lv) {
    Q = { mode: 'bank', c, lv, k: 0, res: [], xp: 0, combo: 0, n: 0, ok: 0 };
    Q.set = [nextBank()]; showQ();
  }
  const nextBank = () => make(Q.lv < 3 ? Q.c.L[Q.lv] : Q.c.L[Math.floor(Math.random() * 3)]);
  const plain = h => h.replace(/<[^>]+>/g, '');
  function showQ() {
    const p = Q.set[Q.k], stage = Q.mode === 'stage';
    Q.input = ''; Q.answered = false;
    const prog = stage ? `<div class="prog" aria-label="5문제 중 ${Q.k + 1}번째">${[0, 1, 2, 3, 4].map(j => `<i class="${j < Q.res.length ? (Q.res[j] ? 'ok' : 'no') : j === Q.k ? 'now' : ''}"></i>`).join('')}</div>`
      : `<div class="combo">연속 정답 ${Q.combo} · 푼 문제 ${Q.n}</div>`;
    const two = p.t === 'mc' && p.opts.every(o => plain(o).length <= 13 && !o.includes('class="fr"') || plain(o).length <= 8);
    const body = p.t === 'mc'
      ? `<div class="opts ${two ? 'two' : ''}" id="opts">${p.opts.map((o, j) => `<button class="opt" type="button" data-o="${j}">${o}</button>`).join('')}</div>`
      : `<div class="field" id="field" aria-live="polite">${p.pre ? `<small>${p.pre}</small>` : ''}<span class="val" id="val"></span>${p.u ? `<small>${p.u}</small>` : ''}</div>
         <div class="pad" id="pad">${['7', '8', '9', '⌫', '4', '5', '6', '−', '1', '2', '3', '/', '0', '.'].map(kc => `<button class="key ${/\d/.test(kc) ? '' : 'fn'}" type="button" data-k="${kc}" aria-label="${{ '⌫': '지우기', '−': '음수 부호', '/': '분수 표시', '.': '소수점' }[kc] || kc}">${kc === '⌫' ? '←' : kc}</button>`).join('')}<button class="key go" type="button" data-k="ok">확인</button></div>`;
    app.innerHTML = `<div class="q-top"><button class="x" type="button" id="quit" aria-label="그만하기">✕</button>${prog}<span class="eyebrow">${stage ? `${Q.i + 1}단계` : '문제은행'}</span></div>
      <section class="qcard"><div class="eyebrow"><span>${esc(Q.c.title)}</span><span>${stage ? `문제 ${Q.k + 1} / 5` : `${Q.n + 1}번째 문제`}</span></div><div class="q">${p.q}</div></section>
      ${body}<div id="fb"></div>`;
    scrollTo(0, 0);
    const quit = $('#quit');
    quit.onclick = () => {
      if (Q.mode === 'bank' || Q.res.length === 0 || quit.classList.contains('sure')) { const id = Q.c.id; Q = null; location.hash = 'c-' + id; route(); showLevelUp(); }
      else { quit.classList.add('sure'); quit.textContent = '그만할까요?'; setTimeout(() => { if (quit.isConnected) { quit.classList.remove('sure'); quit.textContent = '✕'; } }, 2500); }
    };
    if (p.t === 'mc') app.querySelectorAll('.opt').forEach(b => b.onclick = () => answer(+b.dataset.o));
    else $('#pad').onclick = e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); };
  }
  function press(kc) {
    if (!Q || Q.answered) return;
    if (kc === 'ok') { if (Q.input) answer(Q.input); else toast('답을 입력하세요'); return; }
    if (kc === '⌫') Q.input = Q.input.slice(0, -1);
    else if (kc === '−') Q.input = Q.input.startsWith('−') ? Q.input.slice(1) : '−' + Q.input;
    else if (kc === '/') { if (Q.input && !/[/.]$/.test(Q.input) && !Q.input.includes('/') && Q.input !== '−') Q.input += '/'; }
    else if (kc === '.') { const last = Q.input.split('/').pop(); if (/\d$/.test(Q.input) && !last.includes('.')) Q.input += '.'; }
    else if (Q.input.replace(/\D/g, '').length < 9) Q.input += kc;
    $('#val').textContent = Q.input;
  }
  addEventListener('keydown', e => {
    if (!overlay.hidden) { if (e.key === 'Enter' || e.key === 'Escape') { const b = $('#lv-ok'); if (b) b.click(); e.preventDefault(); } return; }
    if (!Q || e.metaKey || e.ctrlKey || e.altKey) return;
    const p = Q.set[Q.k];
    if (Q.answered) { if (e.key === 'Enter') { const n = $('#next'); if (n) { e.preventDefault(); n.click(); } } return; }
    if (p.t === 'num') {
      const m = { Backspace: '⌫', '-': '−', Enter: 'ok' }[e.key] || (/^[0-9/.]$/.test(e.key) ? e.key : null);
      if (m) { e.preventDefault(); press(m); }
    } else if (/^[1-4]$/.test(e.key) && +e.key <= p.opts.length) answer(+e.key - 1);
  });
  function answer(v) {
    if (!Q || Q.answered) return;
    Q.answered = true;
    const p = Q.set[Q.k], ok = check(p, v), stage = Q.mode === 'stage';
    let gain = 0;
    touchStreak(); S.solved++; if (ok) S.correct++;
    if (stage) { Q.res.push(ok); if (ok) gain = 10; }
    else {
      const b = S.bank[Q.c.id] || (S.bank[Q.c.id] = { n: 0, c: 0 });
      b.n++; Q.n++; if (ok) { b.c++; Q.ok++; Q.combo++; gain = 5 + Math.min(Q.combo - 1, 5); } else Q.combo = 0;
    }
    Q.xp += gain; save();
    if (p.t === 'mc') app.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (j === p.a) b.classList.add('right'); else if (j === v) b.classList.add('wrong'); });
    else { $('#field').classList.add(ok ? 'right' : 'wrong'); $('#pad').hidden = true; }
    $('.qcard').insertAdjacentHTML('beforeend', `<svg class="mark" viewBox="0 0 80 80" aria-hidden="true"><path d="${ok ? 'M42 9C22 7 8 22 9 41c1 19 15 31 33 30 18-1 30-15 29-33C70 21 58 10 38 10' : 'M66 12 14 68'}"/></svg>`);
    const last = stage && Q.k === 4;
    $('#fb').innerHTML = `<div class="fb ${ok ? '' : 'no'}" role="status"><h3>${ok ? '정답!' : '아쉬워요'}${gain ? `<small>+${gain} XP${!stage && Q.combo > 1 ? ` · ${Q.combo}연속` : ''}</small>` : ''}</h3>
      ${ok ? '' : `<div class="ans">정답: <b>${p.pre ? p.pre + ' ' : ''}${p.aH}${p.u ? ' ' + p.u : ''}</b></div>`}
      ${p.exp ? `<div class="exp">${p.exp}</div>` : ''}
      ${ok ? '' : `<a class="linkbtn" href="${yt('정승제 ' + Q.c.yt)}" target="_blank" rel="noopener">▶ 정승제 선생님 강의로 복습하기</a>`}
      <button class="btn primary wide" type="button" id="next">${last ? '결과 보기' : '다음 문제'}</button></div>`;
    if (gain) addXp(gain); else drawHud();
    const nx = $('#next');
    nx.onclick = () => {
      if (stage) { if (last) return finishStage(); Q.k++; }
      else { Q.set = [nextBank()]; Q.k = 0; }
      showQ(); showLevelUp();
    };
    nx.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }

  function finishStage() {
    const { c, i, res } = Q, n = res.filter(Boolean).length, before = best(c, i), wasMaster = mastered(c);
    const rows = [[`정답 ${n}개 × 10`, n * 10]];
    let bonus = 0;
    if (n > before) { const a = S.st[c.id] || (S.st[c.id] = [0, 0, 0]); a[i] = n; }
    if (n >= 4 && before < 4) { rows.push(['단계 클리어 보너스', 30]); bonus += 30; }
    if (n === 5 && before < 5) { rows.push(['만점 보너스', 20]); bonus += 20; }
    const nowMaster = mastered(c), got = nowMaster && !wasMaster;
    if (got) { rows.push([`「${c.title}」 정복`, 100]); bonus += 100; }
    save(); if (bonus) addXp(bonus); else drawHud();
    const st = starsOf(n), pass = n >= 4, nx = nextOf(c);
    const total = rows.reduce((s, r) => s + r[1], 0);
    Q = null;
    app.innerHTML = `<section class="result">
      <span class="eyebrow">${esc(c.title)} · ${i + 1}단계 ${STAGE[i]}</span>
      <h1>${n === 5 ? '완벽해요!' : pass ? '단계 클리어!' : n === 3 ? '거의 다 왔어요' : '한 번 더 도전!'}</h1>
      <div class="bigstars" aria-label="별 ${st}개">${[1, 2, 3].map(k => `<span class="${k <= st ? 'on' : ''}">★</span>`).join('')}</div>
      <div class="score">5문제 중 ${n}문제 정답</div>
      ${n === 5 ? '<div class="stamp">참<br>잘했어요</div>' : ''}
      ${got ? `<div class="loot"><span class="ic">${c.item[0]}</span><div><small>새 아이템 획득</small><b>${esc(c.item[1])}</b>「${esc(c.title)}」 개념을 정복한 증표입니다.</div></div>` : ''}
      <div class="sheet tally">${rows.map(r => `<div><span>${esc(r[0])}</span><span>+${r[1]} XP</span></div>`).join('')}<div class="sum"><span>합계</span><span>+${total} XP</span></div></div>
      ${pass ? '' : `<p class="muted" style="margin:0">4문제 이상 맞히면 다음 단계가 열립니다. 개념을 다시 읽고 도전해 보세요.</p>`}
      <div class="actions">
        ${pass && i < 2 ? `<button class="btn primary wide" type="button" id="r-next">${i + 2}단계 ${STAGE[i + 1]} 도전</button>` : ''}
        ${pass && i === 2 && nx ? `<a class="btn primary wide" href="#c-${nx.id}">다음 개념: ${esc(nx.title)}</a>` : ''}
        <button class="btn wide ${pass ? '' : 'primary'}" type="button" id="r-again">${pass ? '같은 단계 다시 풀기' : '다시 도전'}</button>
        <a class="btn wide" href="#c-${c.id}">개념 화면으로</a></div></section>`;
    scrollTo(0, 0);
    if ($('#r-next')) $('#r-next').onclick = () => startStage(c, i + 1);
    $('#r-again').onclick = () => startStage(c, i);
    if (pass) confetti(got ? 140 : n === 5 ? 90 : 50);
    setTimeout(showLevelUp, pass ? 900 : 200);
  }

  /* ───── 가방 ───── */
  function viewBag() {
    const L = levelOf(S.xp), me = rankOf(L.lv), stars = concepts.reduce((s, c) => s + [0, 1, 2].reduce((a, i) => a + starsOf(best(c, i)), 0), 0);
    app.innerHTML = `<a class="linkbtn back" href="#home">← 지도로</a>
      <header class="c-head"><span class="orb">${me[1]}</span><div><span class="eyebrow">내 가방</span><h1>Lv.${L.lv} ${me[2]}</h1></div></header>
      <div class="stats"><div class="stat"><b>${stars} / ${concepts.length * 9}</b><small>모은 별</small></div><div class="stat"><b>${concepts.filter(mastered).length} / ${concepts.length}</b><small>정복한 개념</small></div>
        <div class="stat"><b>${S.solved}</b><small>푼 문제</small></div><div class="stat"><b>${S.solved ? Math.round(S.correct / S.solved * 100) + '%' : '–'}</b><small>정답률</small></div></div>
      <section><h2 style="margin-bottom:8px">칭호</h2><div class="ranks">${RANKS.map(r => `<div class="rank ${L.lv >= r[0] ? 'on' : ''} ${r === me ? 'me' : ''}"><span>${r[1]}</span>${r[2]}<br>Lv.${r[0]}</div>`).join('')}</div></section>
      ${[1, 2, 3].map(g => `<section><h2 style="margin-bottom:8px">${GRADE[g]} 아이템</h2><div class="items">${ofGrade(g).map(c => mastered(c)
        ? `<a class="item on" href="#c-${c.id}"><span>${c.item[0]}</span><b>${esc(c.item[1])}</b>${esc(c.title)}</a>`
        : `<a class="item" href="#c-${c.id}" ${cOpen(c) ? '' : 'aria-disabled="true"'}><span>${c.item[0]}</span><b>???</b>${esc(c.title)}</a>`).join('')}</div></section>`).join('')}
      <section class="sheet"><h2>설정</h2>
        <div class="setting"><p>자유 학습 모드<small>잠금을 풀어 모든 개념과 단계를 바로 풀 수 있습니다.</small></p><button class="btn small ${S.free ? 'primary' : ''}" type="button" id="free" aria-pressed="${S.free}">${S.free ? '켜짐' : '꺼짐'}</button></div>
        <div class="setting"><p>기록 초기화<small>레벨, 별, 아이템이 모두 지워집니다.</small></p><button class="btn small" type="button" id="reset">초기화</button></div></section>`;
    $('#free').onclick = () => { S.free = !S.free; save(); viewBag(); };
    const rs = $('#reset');
    rs.onclick = () => {
      if (rs.dataset.sure) { S = fresh(); save(); drawHud(); location.hash = 'home'; route(); toast('기록을 초기화했습니다'); }
      else { rs.dataset.sure = '1'; rs.textContent = '정말 지울까요?'; rs.classList.add('red'); setTimeout(() => { if (rs.isConnected) { delete rs.dataset.sure; rs.textContent = '초기화'; rs.classList.remove('red'); } }, 3000); }
    };
    app.querySelectorAll('.item[aria-disabled]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); toast('아직 잠겨 있는 개념입니다'); }));
  }

  /* ───── 화면 전환 ───── */
  function route() {
    Q = null;
    const h = location.hash.replace(/^#/, '');
    const c = h.startsWith('c-') && concepts.find(x => x.id === h.slice(2));
    if (c) { S.grade = c.g; viewConcept(c); }
    else if (h === 'bag') viewBag();
    else viewHome();
    scrollTo(0, 0);
  }
  addEventListener('hashchange', route);
  /* 주소(#)가 이미 같은 화면을 가리킬 때도 링크가 동작하도록 */
  document.addEventListener('click', e => { const a = e.target.closest('a[href^="#"]'); if (a && !a.hasAttribute('aria-disabled') && a.getAttribute('href') === location.hash) { e.preventDefault(); route(); } });
  drawHud(); route();
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(drawTrail);
})();
