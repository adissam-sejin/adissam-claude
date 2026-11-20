// 주보 화면 그리기. 주보 페이지와 관리자 미리보기가 같이 씁니다.
(function () {
  const { el, D } = window.App;
  const lines = (s) => (s || '').split('\n').map((x) => x.replace(/\s+$/, '')).filter((x) => x.trim() !== '');

  // 명단(roster)에서 해당 주일 담당자를 찾음
  function rosterFor(roster, date) {
    return (roster || []).find((r) => r.date === date) || {};
  }

  // 예배 순서 한 줄에 실제로 보일 내용을 계산 (대표기도·말씀봉독·설교는 자동)
  function resolveItem(it, b, r) {
    const c = b.content;
    const out = { stand: !!it.stand, title: it.title || '', who: it.who || '', accent: '', sub: it.sub || '', quote: '' };
    if (it.auto === 'prayer' && !out.sub) {
      const parts = [];
      if (r.prayer1) parts.push('1부: ' + r.prayer1);
      if (r.prayer2) parts.push('2부: ' + r.prayer2);
      out.sub = parts.join('\n/ ');
    } else if (it.auto === 'reading') {
      out.accent = (c.sermon && c.sermon.scripture) || '';
      if (!out.sub) {
        const parts = [];
        if (c.leader) parts.push('1부: ' + c.leader);
        if (r.reader2) parts.push('2부: ' + r.reader2);
        out.sub = parts.join('\n/ ');
      }
    } else if (it.auto === 'memory') {
      if (!out.who) out.who = c.prevMemoryRef || ''; // 지난주 암송구절
    } else if (it.auto === 'sermon') {
      if (!out.who) out.who = (c.sermon && c.sermon.preacher) || '';
      out.quote = (c.sermon && c.sermon.title) || '';
    }
    return out;
  }

  function section(cls, title, kids) {
    return el('section', { class: 'b-sec ' + cls }, title ? el('h2', { class: 'b-title' }, title) : null, kids);
  }

  function render(host, b, roster, settings) {
    const c = b.content || {};
    const ch = settings.church;
    const r = rosterFor(roster, b.date);
    host.textContent = '';
    host.classList.add('bulletin');

    // 1. 표지: 호수·날짜와 주제 말씀만 (로고와 붓글씨는 홈 화면에 있음)
    host.appendChild(el('section', { class: 'b-cover' },
      el('h1', { class: 'b-issue' }, [b.issue, D.dot(b.date)].filter(Boolean).join(' ')),
      ch.verse ? el('p', { class: 'b-verse' }, ch.verse) : null));

    // 2. 예배 순서
    const order = (c.order || []).filter((it) => it.title).map((it) => resolveItem(it, b, r));
    if (order.length) {
      host.appendChild(section('b-worship', null, [
        el('h2', { class: 'b-eng' }, 'WORSHIP'),
        el('p', { class: 'b-times' }, lines(c.worshipTimes).map((t) => {
          const i = t.indexOf('_');
          return el('span', null, i > 0 ? [el('b', null, t.slice(0, i + 1)), t.slice(i + 1)] : t);
        })),
        el('div', { class: 'b-bar' }, el('span', null, '※표는 일어서서'), c.leader ? el('span', null, '인도: ' + c.leader) : null),
        el('ol', { class: 'b-order' }, order.map((it) => el('li', null,
          el('p', { class: 'b-item' },
            it.stand ? el('span', { class: 'b-stand', title: '일어서서' }, '※') : null,
            el('b', null, it.title),
            it.accent ? [' / ', el('em', null, it.accent)] : null,
            it.who ? ' / ' + it.who : null),
          it.sub ? el('p', { class: 'b-sub' }, it.sub) : null,
          it.quote ? el('p', { class: 'b-quote' }, '“' + it.quote + '”') : null)))
      ]));
    }

    // 3. 교회 소식 + 일정
    const news = (c.news || []).filter((n) => n.title || n.body);
    const sched = lines(c.schedule);
    if (news.length || sched.length) {
      host.appendChild(section('b-news', null, [
        el('h2', { class: 'b-eng' }, 'NEWS'),
        news.map((n) => el('article', { class: 'b-news-item' },
          n.title ? el('h3', null, n.title) : null,
          n.body ? el('p', null, n.body) : null)),
        sched.length ? el('div', { class: 'b-sched' },
          el('h3', null, '▩ 교회 일정'),
          el('ul', null, sched.map((s) => {
            const m = s.match(/^(\S+)\s+(.*)$/);
            return el('li', null, m ? [el('span', null, m[1]), m[2]] : s);
          }))) : null
      ]));
    }

    // 4. 셀 나눔
    const qs = lines(c.cellQuestions);
    if ((c.cellText || '').trim() || qs.length) {
      host.appendChild(section('b-cell', '셀 나눔 • 개인 적용', [
        lines(c.cellText).map((p) => el('p', { class: 'b-para' }, p.trim())),
        qs.length ? el('ol', { class: 'b-qs' }, qs.map((q) => el('li', null, q.replace(/^\d+[.)]\s*/, '')))) : null
      ]));
    }

    // 5. 암송 말씀
    if (c.memory && (c.memory.text || c.memory.ref)) {
      host.appendChild(el('section', { class: 'b-sec b-memory' },
        el('h2', { class: 'b-title' }, '이번주 암송말씀'),
        c.memory.ref ? el('p', { class: 'b-memory-ref' }, c.memory.ref) : null,
        el('p', { class: 'b-memory-text' }, c.memory.text || '')));
    }

    // 6. 예배위원/담당 — 명단에서 다음 주일들을 자동으로 불러옴
    const weeks = Math.max(0, Math.min(8, c.dutyWeeks == null ? 2 : +c.dutyWeeks));
    const duty = [];
    for (let i = 1; i <= weeks; i++) {
      const dt = D.add(b.date, 7 * i);
      const x = rosterFor(roster, dt);
      const rows = [];
      if (x.prayer1) rows.push('1부 대표기도: ' + x.prayer1);
      if (x.prayer2) rows.push('2부 대표기도: ' + x.prayer2);
      if (x.reader2) rows.push('2부 성경봉독: ' + x.reader2);
      if (x.dish) rows.push('설거지담당: ' + x.dish);
      if (rows.length) duty.push(el('div', { class: 'b-duty' }, el('h3', null, D.kor(dt)), rows.map((t) => el('p', null, t))));
    }
    if (duty.length) host.appendChild(section('b-duties', '예배위원/담당', duty));

    // 7. 생일
    const bd = lines(c.birthdays);
    if (bd.length) {
      host.appendChild(el('section', { class: 'b-sec b-birth' },
        el('h2', { class: 'b-title' }, '생일축하합니다'),
        el('ul', null, bd.map((s) => el('li', null, s)))));
    }

    // 8. 헌금 계좌 (명단은 주보에 싣지 않고, 비밀번호가 있는 ‘헌금명단’ 메뉴에서만 보임)
    if (ch.account) {
      host.appendChild(section('b-offer', '온라인 헌금 계좌', [
        el('p', { class: 'b-account' }, ch.account),
        el('p', { class: 'b-offer-link' }, el('a', { href: 'offering.html' }, '헌금명단 보기'), ' · 교인용 (비밀번호 필요)')
      ]));
    }
  }

  window.BulletinView = { render, rosterFor };
})();
