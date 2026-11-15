/* 화면 렌더링과 라우팅 */
(function () {
  const C = window.C8, S = C.store, { TYPES, CATS, QUESTIONS, ANSWERS } = C;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const idxOf = id => TYPES.findIndex(t => t.id === id);
  const fmtDate = d => d ? new Date(d).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
  const view = $('#view');
  let test = null;      // { i, answers }
  let checkQuery = '';
  let openDay = 0;

  const route = () => (location.hash.replace(/^#\/?/, '').split('?')[0] || 'home');
  const go = r => { if (route() === r) render(); else location.hash = '#/' + r; };
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('show'), 2600); }

  const disclaimer = `<p class="note">8체질은 한의학의 체질 이론으로, 이 테스트는 음식 반응을 바탕으로 한 <b>참고용 자가 점검</b>입니다. 의학적 진단이 아니며, 정확한 감별은 8체질 전문 한의원의 맥진으로 이루어집니다. 질환이 있거나 식단을 크게 바꾸려면 의료진과 상의하세요.</p>`;

  const loginButtons = () => `
    <div class="login-btns">
      <button class="btn kakao" data-act="login" data-p="kakao">카카오로 시작하기</button>
      <button class="btn naver" data-act="login" data-p="naver">네이버로 시작하기</button>
    </div>
`;

  /* ---------- 홈 ---------- */
  function home() {
    const cur = S.current();
    const t = cur && TYPES[idxOf(cur.constitution)];
    return `
    <section class="hero">
      <h1><span>내 몸에 맞는</span>8체질 밥상</h1>
      <p class="lead">음식을 먹고 난 뒤의 느낌 ${QUESTIONS.length}가지를 체크하면, 여덟 체질 중 어디에 가까운지와 나에게 맞는 음식을 알려드려요.</p>
      <svg class="art" viewBox="0 0 320 210" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 96c8-7 16-7 24 0s16 7 24 0M6 108c8-7 16-7 24 0s16 7 24 0"/>
        <circle cx="276" cy="34" r="19"/><circle cx="52" cy="150" r="4"/><circle cx="262" cy="92" r="4"/><circle cx="296" cy="140" r="5"/><circle cx="84" cy="52" r="3"/>
        <path d="M136 58c-8-10 8-14 0-26M162 52c-8-10 8-14 0-26M188 58c-8-10 8-14 0-26"/>
        <path d="M92 112c6-30 34-44 68-44s62 14 68 44" fill="#fff"/>
        <path d="M118 96c4-6 10-6 14 0M150 86c4-6 10-6 14 0M184 96c4-6 10-6 14 0M134 106c4-6 10-6 14 0M168 106c4-6 10-6 14 0"/>
        <path d="M74 112h172c0 42-34 66-86 66s-86-24-86-66z" fill="#2b2b2b"/>
        <path d="M132 178h56v12h-56z" fill="#2b2b2b"/>
        <path d="M206 74l76-40M214 82l76-40"/>
        <path d="M0 196h60l8-22 6 22 8-30 7 30 9-18 5 18h114l7-24 6 24 9-32 6 32 8-16 5 16h52"/>
      </svg>
      <a class="btn primary wide" href="#/test">${t ? '테스트 다시 하기' : (S.local ? '테스트 시작' : '가입 없이 테스트 시작')} <span>→</span></a>
      ${t ? `<a class="btn wide" href="#/result">내 결과 보기 · ${t.name}</a>` : '<a class="btn wide" href="#/about">8체질이란?</a>'}
      <p class="meta center">약 3분 · 회원가입 없음 · 결과는 내 브라우저에만 저장</p>
    </section>
    <section>
      <h2>여덟 가지 체질</h2>
      <div class="type-grid">${TYPES.map(x => `<a class="type-chip" href="#/about" style="--c:${x.color}"><b>${x.name}</b><span>${x.strong} 강 · ${x.weak} 약</span></a>`).join('')}</div>
    </section>
    <section>
      <h2>이렇게 써요</h2>
      <ol class="steps">
        <li><b>테스트</b><span>음식을 먹은 뒤의 느낌을 체크합니다. 가입은 필요 없어요.</span></li>
        <li><b>결과 확인</b><span>가까운 체질 순위와 맞는 음식·안 맞는 음식을 봅니다.</span></li>
        <li><b>저장하고 활용</b><span>${S.local ? '결과는 이 브라우저에 자동 저장되고, 일주일 추천 식단과 음식 확인에 바로 쓰여요.' : '카카오·네이버로 가입하면 결과가 저장되고, 일주일 추천 식단을 받을 수 있어요.'}</span></li>
      </ol>
    </section>
    ${disclaimer}`;
  }

  /* ---------- 테스트 ---------- */
  function testView() {
    if (!test) test = { i: -1, answers: {} };
    if (test.i < 0) return `
      <section class="card center narrow">
        <h1>8체질 테스트</h1>
        <p class="lead">아래 음식을 <b>평소에 먹었을 때</b> 몸이 어땠는지 떠올려 골라 주세요. 좋아하는 맛이 아니라 <b>먹고 난 뒤의 몸 상태</b>가 기준입니다.</p>
        <ul class="plain">
          <li>문항 ${QUESTIONS.length}개 · 약 3분</li>
          <li>잘 안 먹는 음식은 "모르겠다"를 고르면 계산에서 빠집니다</li>
          ${S.local ? '<li>결과는 서버로 보내지 않고 이 브라우저에만 저장됩니다</li>' : S.user ? '<li>완료하면 내 계정의 체질 결과가 새 결과로 업데이트됩니다</li>' : '<li>가입 없이 결과를 볼 수 있어요</li>'}
        </ul>
        <button class="btn primary" data-act="start">시작하기</button>
      </section>${disclaimer}`;
    const q = QUESTIONS[test.i], opts = ANSWERS[q.kind], cur = test.answers[q.id];
    return `
      <section class="card quiz narrow">
        <div class="progress"><i style="width:${Math.round(test.i / QUESTIONS.length * 100)}%"></i></div>
        <p class="meta">${test.i + 1} / ${QUESTIONS.length} · ${q.kind === 'food' ? '음식 반응' : '몸의 반응'}</p>
        <h2 class="qtext">${esc(q.text)}${q.kind === 'food' ? ' 내 몸은?' : ''}</h2>
        <div class="opts">${opts.map(([label, v], k) => `<button class="opt${q.id in test.answers && cur === v ? ' on' : ''}" data-act="answer" data-k="${k}">${label}</button>`).join('')}</div>
        <div class="row between"><button class="btn ghost" data-act="prev">← 이전</button><button class="btn ghost" data-act="quit">그만하기</button></div>
      </section>`;
  }
  async function finishTest() {
    const r = C.score(test.answers);
    const result = { constitution: TYPES[r.top].id, source: 'test', scores: r.ranking.map(x => ({ id: x.id, pct: x.pct })), answers: test.answers, tested_at: new Date().toISOString(), answered: r.answered, reliable: r.reliable };
    test = null;
    try { await S.saveResult(result); if (S.user) toast(S.local ? '결과를 이 브라우저에 저장했어요' : '체질 결과가 계정에 저장되었습니다'); }
    catch (e) { S.setGuest(result); toast('저장에 실패해 이 기기에 임시 보관했습니다'); }
    go('result');
  }

  /* ---------- 결과 ---------- */
  function foodBlock(lists, cls) {
    const cats = Object.keys(CATS).filter(c => lists[c]);
    return cats.map(c => `<div class="food-row"><span class="cat">${CATS[c]}</span><div class="tags">${lists[c].map(n => `<button class="tag ${cls}" data-act="chip" data-q="${esc(n)}">${esc(n)}</button>`).join('')}</div></div>`).join('');
  }
  function result() {
    const cur = S.current();
    if (!cur) return `<section class="card center narrow"><h1>아직 결과가 없어요</h1><p class="lead">테스트를 하면 가까운 체질과 맞는 음식을 볼 수 있어요.</p><a class="btn primary" href="#/test">테스트 시작</a></section>`;
    const i = idxOf(cur.constitution), t = TYPES[i], lists = C.foodLists(i);
    const scores = cur.scores;
    const second = scores && TYPES[idxOf(scores[1].id)];
    return `
    <section class="result-hero" style="--c:${t.color}">
      <p class="eyebrow">${cur.source === 'manual' ? '직접 선택한 체질' : '나와 가장 가까운 체질'}</p>
      <h1>${t.name} <small>${t.en}</small></h1>
      <p class="lead">${t.summary}</p>
      <p class="organs">장부 강약 · ${t.organs}</p>
      ${scores ? `<p class="pills"><span>일치도 ${scores[0].pct}%</span>${second ? `<span>2순위 ${second.name} ${scores[1].pct}%</span>` : ''}</p>` : ''}
    </section>
    ${scores && (cur.reliable === false || scores[0].pct - scores[1].pct < 5) ? `<p class="note warn">1·2순위 차이가 작거나 응답 수가 적어 결과가 뚜렷하지 않습니다. 2순위 체질도 함께 참고하고, 음식을 먹은 뒤의 반응을 좀 더 살펴본 뒤 다시 테스트해 보세요.</p>` : ''}
    ${scores ? `<section><h2>여덟 체질과의 가까운 정도</h2><div class="bars">${scores.map(s => { const x = TYPES[idxOf(s.id)]; return `<div class="bar"><span>${x.name}</span><div class="track"><i style="width:${s.pct}%"></i></div><b>${s.pct}%</b></div>`; }).join('')}</div>
      <p class="note small">같은 계열의 양·음 체질(예: 금양·금음)은 음식 반응이 비슷해 설문만으로는 구분이 어렵습니다.</p></section>` : ''}
    <section><h2>이런 특징이 있어요</h2><ul class="bullets">${t.traits.map(x => `<li>${x}</li>`).join('')}</ul></section>
    <section><h2 class="good-h">나에게 맞는 음식</h2><div class="foods">${foodBlock(lists.good, 'good')}</div></section>
    <section><h2 class="bad-h">나에게 안 맞는 음식</h2><div class="foods">${foodBlock(lists.bad, 'bad')}</div>
      <p class="note small">음식 이름을 누르면 자세한 설명을 볼 수 있어요. 목록에 없는 음식은 '보통'으로 분류됩니다.</p></section>
    <section><h2>생활 가이드</h2><ul class="bullets">${t.tips.map(x => `<li>${x}</li>`).join('')}</ul></section>
    ${S.user ? `<div class="row"><a class="btn primary" href="#/plan">일주일 추천 식단 보기</a><a class="btn" href="#/check">음식 확인하기</a></div>`
      : `<section class="card save"><h2>결과를 저장하고 식단까지 받아보세요</h2><p>가입하면 이 결과가 내 계정에 저장되고, 체질에 맞춘 일주일 추천 식단을 받을 수 있어요.</p>${loginButtons()}</section>`}
    ${disclaimer}`;
  }

  /* ---------- 음식 확인 ---------- */
  function checkView() {
    const cur = S.current();
    if (!cur) return `<section class="card center narrow"><h1>음식 확인</h1><p class="lead">내 체질을 먼저 알아야 음식이 맞는지 확인할 수 있어요.</p><a class="btn primary" href="#/test">테스트 시작</a>
      <p class="meta">이미 체질을 알고 있다면 <a href="#/me">내 정보</a>에서 직접 선택할 수 있어요.</p></section>`;
    const i = idxOf(cur.constitution), t = TYPES[i];
    return `
    <section>
      <h1>음식 확인</h1>
      <p class="lead"><b class="hl">${t.name}</b> 기준으로 음식이나 재료가 나에게 맞는지 확인해요.</p>
      <form class="search" data-form="check"><input id="q" type="search" placeholder="예: 삼겹살, 사과, 김치찌개" value="${esc(checkQuery)}" autocomplete="off" enterkeyhint="search"><button class="btn primary">확인</button></form>
      <div class="tags quick">${['쇠고기', '고등어', '우유', '커피', '사과', '김치찌개', '삼계탕', '라면'].map(n => `<button class="tag" data-act="chip" data-q="${n}">${n}</button>`).join('')}</div>
      <div id="check-out">${checkQuery ? checkResult(checkQuery, i) : ''}</div>
    </section>`;
  }
  function checkResult(q, i) {
    const r = C.check(q, i);
    if (!r.found) return `<div class="verdict v0"><span class="badge">정보 없음</span><h3>${esc(q)}</h3><p>아직 데이터에 없는 음식이에요. 주재료 이름(예: 돼지고기, 밀가루)으로 다시 검색해 보세요.</p></div>`;
    const cls = r.verdict > 0 ? 'vg' : r.verdict < 0 ? 'vb' : 'v0';
    return `<div class="verdict ${cls}"><span class="badge">${r.label}</span>
      <h3>${esc(r.title)}${r.cat ? ` <small>${r.cat}</small>` : ''}</h3>
      ${r.matched ? `<p class="meta">"${esc(q)}" → 주재료 <b>${esc(r.matched)}</b> 기준으로 판단했어요.</p>` : ''}
      <p>${r.explain}</p>
      ${r.parts ? `<div class="tags">${r.parts.map(p => `<span class="tag ${p.r > 0 ? 'good' : p.r < 0 ? 'bad' : ''}">${p.name} · ${p.r > 0 ? '좋음' : p.r < 0 ? '안 좋음' : '보통'}</span>`).join('')}</div>` : ''}</div>`;
  }

  /* ---------- 식단 ---------- */
  function planView() {
    if (!S.user) return `<section class="card center narrow"><h1>일주일 추천 식단</h1><p class="lead">가입한 회원에게 체질에 맞는 음식 위주로 일주일 식단을 추천해 드려요.</p>${loginButtons()}</section>`;
    const p = S.profile;
    if (!p.constitution) return `<section class="card center narrow"><h1>일주일 추천 식단</h1><p class="lead">먼저 체질 테스트를 해 주세요.</p><a class="btn primary" href="#/test">테스트 시작</a></section>`;
    const i = idxOf(p.constitution), t = TYPES[i], n = p.meals_per_day, days = C.plan(i, n, p.plan_seed);
    const avg = k => Math.round(days.reduce((s, d) => s + d.total[k], 0) / 7);
    const dayCard = (d, k) => { const e = d.total.p * 4 + d.total.c * 4 + d.total.f * 9, pc = x => Math.round(x / e * 100); return `
      <div class="day card${k === openDay ? ' on' : ''}">
        <div class="row between"><h2>${d.day}요일</h2><span class="meta">${d.total.kcal.toLocaleString()} kcal</span></div>
        <div class="macro" title="에너지 비율"><i class="mc" style="width:${pc(d.total.c * 4)}%"></i><i class="mp" style="width:${pc(d.total.p * 4)}%"></i><i class="mf" style="width:${pc(d.total.f * 9)}%"></i></div>
        <p class="meta legend"><span class="dot mc"></span>탄수화물 ${pc(d.total.c * 4)}% <span class="dot mp"></span>단백질 ${pc(d.total.p * 4)}% <span class="dot mf"></span>지방 ${pc(d.total.f * 9)}%</p>
        ${d.meals.map(m => `<div class="meal"><div class="row between"><h3>${m.label}</h3><span class="meta">${m.kcal} kcal</span></div>
          <ul>${m.dishes.map(x => `<li><b>${x.name}</b>${x.plus.length ? `<span class="plus">이로운 재료 · ${x.plus.join(', ')}</span>` : ''}</li>`).join('')}</ul></div>`).join('')}
      </div>`; };
    return `
    <section>
      <h1>일주일 추천 식단</h1>
      <p class="lead"><b class="hl">${t.name}</b>에 이로운 재료 위주로, 해로운 재료는 빼고 구성했어요.</p>
      <div class="field"><span>하루 몇 끼를 추천받을까요?</span>
        <div class="seg">${[2, 3, 4, 5].map(k => `<button class="${k === n ? 'on' : ''}" data-act="meals" data-n="${k}">${k === 4 ? '3끼+간식1' : k === 5 ? '3끼+간식2' : k + '끼'}</button>`).join('')}</div></div>
      <div class="stats"><div><b>${avg('kcal').toLocaleString()}</b><span>하루 평균 kcal</span></div><div><b>${avg('p')}g</b><span>단백질</span></div><div><b>${avg('c')}g</b><span>탄수화물</span></div><div><b>${avg('f')}g</b><span>지방</span></div></div>
      <div class="daytabs">${days.map((x, k) => `<button class="${k === openDay ? 'on' : ''}" data-act="day" data-k="${k}">${x.day}</button>`).join('')}</div>
      <div class="week">${days.map(dayCard).join('')}</div>
      <div class="row"><button class="btn" data-act="reroll">다른 식단으로 다시 추천</button><button class="btn ghost" data-act="print">인쇄</button></div>
      <p class="note small">매 끼니를 주식(탄수화물)·단백질 반찬·채소 반찬으로 구성하고 점심·저녁에는 국을 더했습니다. 열량과 영양소는 1인분 기준 대략값이며, 활동량과 체격에 따라 밥 양을 조절하세요.</p>
      <div class="print-only">${days.map(x => `<h3>${x.day}요일 (${x.total.kcal} kcal)</h3>${x.meals.map(m => `<p><b>${m.label}</b> ${m.dishes.map(y => y.name).join(', ')}</p>`).join('')}`).join('')}</div>
    </section>`;
  }

  /* ---------- 내 정보 ---------- */
  function me() {
    if (!S.user) {
      const g = S.guest();
      return `<section class="card center narrow"><h1>내 정보</h1><p class="lead">가입하면 체질 테스트 결과가 저장되고, 일주일 추천 식단을 받을 수 있어요.</p>${loginButtons()}
        ${g ? `<p class="meta">가입하면 방금 한 테스트 결과(${TYPES[idxOf(g.constitution)].name})가 계정으로 옮겨집니다.</p>` : ''}</section>
        <section><h2>체질을 이미 알고 있나요?</h2><p class="meta">한의원에서 진단받은 체질이 있다면 직접 선택해 사용할 수 있어요.</p>${manualSelect(g && g.constitution)}</section>`;
    }
    const p = S.profile, t = p.constitution && TYPES[idxOf(p.constitution)];
    return `
    <section>
      <h1>내 정보</h1>
      ${S.local ? '<p class="note">회원가입 없이 사용합니다. 체질 결과와 식단 설정은 <b>지금 쓰는 이 브라우저에만</b> 저장되고 서버로 전송되지 않아요. 브라우저 데이터를 지우거나 다른 기기·브라우저에서 열면 보이지 않습니다.</p>'
        : `<div class="card profile"><div class="avatar ${esc(S.user.provider)}">${S.user.provider === 'naver' ? 'N' : 'K'}</div><div><b>${esc(S.user.name)}</b><span class="meta">${S.user.provider === 'naver' ? '네이버' : '카카오'} 계정</span></div></div>`}
    </section>
    <section>
      <h2>나의 체질</h2>
      ${t ? `<div class="card mine" style="--c:${t.color}"><div><b class="tname">${t.name}</b><span class="meta">${p.source === 'manual' ? '직접 선택' : `일치도 ${p.scores ? p.scores[0].pct : '-'}%`} · ${fmtDate(p.tested_at)}</span></div><a class="btn" href="#/result">결과 보기</a></div>`
          : '<p class="meta">아직 저장된 체질 결과가 없어요.</p>'}
      <div class="row"><button class="btn primary" data-act="retake">${t ? '체질 테스트 다시 하기' : '체질 테스트 하기'}</button></div>
      <p class="note small">다시 테스트하면 새 결과로 내 체질이 업데이트되고, 식단과 음식 확인에도 바로 반영됩니다. 이전 결과는 아래 기록에 남아요.</p>
    </section>
    <section><h2>체질 직접 선택</h2><p class="meta">한의원에서 진단받은 체질이 있다면 그 체질로 바꿀 수 있어요.</p>${manualSelect(p.constitution)}</section>
    <section><h2>테스트 기록</h2>
      ${p.history && p.history.length ? `<ul class="history">${p.history.map(h => `<li><b>${TYPES[idxOf(h.constitution)].name}</b><span class="meta">${h.source === 'manual' ? '직접 선택' : `일치도 ${h.top_pct}%`} · ${fmtDate(h.created_at)}</span></li>`).join('')}</ul>` : '<p class="meta">기록이 없습니다.</p>'}
    </section>
    <section class="row">${S.local ? '' : '<button class="btn" data-act="logout">로그아웃</button>'}<button class="btn ghost danger" data-act="wipe">저장된 내 데이터 삭제</button></section>`;
  }
  const manualSelect = sel => `<div class="type-grid">${TYPES.map(x => `<button class="type-chip${x.id === sel ? ' on' : ''}" data-act="manual" data-id="${x.id}" style="--c:${x.color}"><b>${x.name}</b><span>${x.strong} 강 · ${x.weak} 약</span></button>`).join('')}</div>`;

  /* ---------- 8체질 소개 ---------- */
  function about() {
    return `
    <section><h1>8체질이란?</h1>
      <p class="lead">8체질의학은 한의사 권도원이 1965년 국제 침구학회에서 처음 발표한 한국의 체질의학입니다. 사람마다 타고난 <b>장부(오장육부)의 강약 배열</b>이 여덟 가지로 다르고, 그에 따라 맞는 음식·운동·목욕법이 다르다고 봅니다.</p>
      <ul class="bullets">
        <li>이제마의 사상의학(태양·태음·소양·소음)과 뿌리가 닿아 있지만 여덟 가지로 더 세분합니다.</li>
        <li>체질 감별은 손목의 맥을 짚는 <b>8체질 맥진</b>으로 하며, 숙련이 필요하고 한의사마다 결과가 달라질 수 있다는 한계가 지적됩니다.</li>
        <li>체질별 식사법(섭생표)은 "강한 장기를 더 강하게 하는 음식은 피하고, 약한 장기를 돕는 음식을 먹는다"는 원리입니다.</li>
        <li>금·수 계열 네 체질은 교감신경 긴장형, 목·토 계열 네 체질은 부교감신경 긴장형으로 설명합니다.</li>
      </ul></section>
    <section><h2>여덟 체질 한눈에 보기</h2>
      ${TYPES.map(t => `<div class="card about-type" style="--c:${t.color}"><h3>${t.name} <small>${t.en}</small></h3><p class="organs">${t.organs}</p><p>${t.summary}</p></div>`).join('')}</section>
    <section><h2>알아두세요: 근거 수준</h2>
      <ul class="bullets">
        <li>2024년 8체질의학 임상연구 범위 고찰(scoping review)에 따르면, 원저 47편 중 39편이 관찰연구였고 체질 식이의 효과를 검증한 임상연구는 부족한 상태입니다.</li>
        <li>설문지로 체질을 가려내는 방법의 타당도·신뢰도는 아직 충분히 확립되지 않았습니다. 이 앱의 결과도 "가까운 정도"를 보여주는 참고 자료입니다.</li>
        <li>섭생표는 여러 차례 개정되었고 한의원마다 세부 분류가 조금씩 다릅니다.</li>
        <li>특정 식품군을 통째로 끊으면 영양 불균형이 올 수 있으니, 질환이 있거나 임신·성장기라면 의료진과 상의하세요.</li>
      </ul></section>
    <div class="row"><a class="btn primary" href="#/test">테스트 하러 가기</a></div>`;
  }

  const VIEWS = { home, test: testView, result, check: checkView, plan: planView, me, about };
  function render() {
    const r = VIEWS[route()] ? route() : 'home';
    view.innerHTML = VIEWS[r]();
    document.querySelectorAll('nav a').forEach(a => a.classList.toggle('on', a.dataset.r === r));
    $('#who').textContent = S.user ? S.user.name : '로그인';
    $('#who').hidden = S.local;
  }

  /* ---------- 이벤트 ---------- */
  const acts = {
    start() { test.i = 0; render(); },
    quit() { test = null; go('home'); },
    prev() { test.i -= 1; render(); },
    answer(el) {
      const q = QUESTIONS[test.i];
      test.answers[q.id] = ANSWERS[q.kind][+el.dataset.k][1];
      if (test.i + 1 >= QUESTIONS.length) return finishTest();
      test.i += 1; render(); window.scrollTo(0, 0);
    },
    retake() { test = null; go('test'); },
    chip(el) { checkQuery = el.dataset.q; go('check'); window.scrollTo(0, 0); },
    day(el) { openDay = +el.dataset.k; render(); },
    async meals(el) { await S.saveSettings({ meals_per_day: +el.dataset.n }); render(); },
    async reroll() { await S.saveSettings({ plan_seed: Math.floor(Math.random() * 1e9) + 1 }); render(); toast('새 식단을 추천했어요'); },
    print() { window.print(); },
    async login(el) { await S.signIn(el.dataset.p); },
    async logout() { await S.signOut(); toast('로그아웃되었습니다'); },
    async manual(el) {
      const t = TYPES[idxOf(el.dataset.id)];
      if (!confirm(`내 체질을 ${t.name}(으)로 설정할까요?`)) return;
      await S.saveResult({ constitution: t.id, source: 'manual', scores: null, answers: null, tested_at: new Date().toISOString() });
      toast(`${t.name}(으)로 설정했습니다`); render();
    },
    async wipe() { if (!confirm('저장된 체질 결과와 기록을 모두 삭제할까요? 되돌릴 수 없습니다.')) return; await S.deleteData(); toast('삭제되었습니다'); render(); },
  };
  document.addEventListener('click', async e => {
    const el = e.target.closest('[data-act]');
    if (!el || !acts[el.dataset.act]) return;
    try { await acts[el.dataset.act](el); } catch (err) { console.error(err); toast('문제가 발생했습니다: ' + (err.message || err)); }
  });
  document.addEventListener('submit', e => {
    if (e.target.dataset.form !== 'check') return;
    e.preventDefault(); checkQuery = $('#q').value.trim(); render(); $('#q').focus();
  });
  window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });
  S.onChange(render);
  S.init().catch(err => { console.error(err); toast('로그인 서버에 연결하지 못했습니다'); }).then(render);
})();
