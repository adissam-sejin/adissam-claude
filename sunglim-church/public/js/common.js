// 여러 페이지가 함께 쓰는 도우미: 요소 만들기, 날짜, 상단 메뉴, 하단 정보.
(function () {
  // el('div', {class:'x', onclick:fn}, '글자', 다른요소...) — 글자는 항상 텍스트로 들어가 안전합니다.
  function el(tag, props) {
    const n = document.createElement(tag);
    if (props) {
      for (const k in props) {
        const v = props[k];
        if (v == null || v === false) continue;
        if (k === 'class') n.className = v;
        else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), v);
        else if (k === 'value') n.value = v;
        else if (k === 'checked') n.checked = !!v;
        else n.setAttribute(k, v === true ? '' : v);
      }
    }
    for (let i = 2; i < arguments.length; i++) add(n, arguments[i]);
    return n;
  }
  function add(n, c) {
    if (c == null || c === false) return;
    if (Array.isArray(c)) c.forEach((x) => add(n, x));
    else n.appendChild(c.nodeType ? c : document.createTextNode(String(c)));
  }

  // 링크는 http(s)·전화·메일·사이트 안 주소만 허용
  function safeUrl(u) {
    u = (u || '').trim();
    if (!u) return '#';
    if (/^(https?:\/\/|mailto:|tel:)/i.test(u)) return u;
    if (/^[\w./?#=&%-]+$/.test(u) && u.indexOf(':') < 0) return u;
    if (/^[\w-]+(\.[\w-]+)+/.test(u)) return 'https://' + u; // "naver.com" 처럼 앞부분을 빼고 쓴 경우
    return '#';
  }
  const isExternal = (u) => /^https?:\/\//i.test(u);

  // 표어 붓글씨 이미지: 관리자에서 올린 것이 있으면 그것, 없으면 기본 이미지
  function calliSrc(settings) {
    const u = ((settings.church || {}).calliUrl || '').trim();
    if (/^\/api\/images\/[\w.-]+$/.test(u) || /^https:\/\/[^\s"'<>]+$/.test(u) || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(u)) return u;
    return 'assets/calli-white.png';
  }

  // ---------- 날짜 ----------
  const pad = (n) => (n < 10 ? '0' : '') + n;
  const D = {
    parse(s) { const p = s.split('-').map(Number); return new Date(p[0], p[1] - 1, p[2]); },
    iso(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); },
    add(s, days) { const d = D.parse(s); d.setDate(d.getDate() + days); return D.iso(d); },
    dot(s) { const d = D.parse(s); return d.getFullYear() + '.' + pad(d.getMonth() + 1) + '.' + pad(d.getDate()); },
    kor(s) { const d = D.parse(s); return (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; },
    korFull(s) { const d = D.parse(s); return d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일'; },
    today() { return D.iso(new Date()); },
    // 오늘이 주일이면 오늘, 아니면 다가오는 주일
    nextSunday(from) { const d = from ? D.parse(from) : new Date(); d.setDate(d.getDate() + ((7 - d.getDay()) % 7)); return D.iso(d); },
    sundaysOfYear(y) {
      const out = []; const d = new Date(y, 0, 1);
      d.setDate(d.getDate() + ((7 - d.getDay()) % 7));
      while (d.getFullYear() === y) { out.push(D.iso(d)); d.setDate(d.getDate() + 7); }
      return out;
    }
  };

  // ---------- 상단 메뉴 ----------
  function renderNav(settings, active) {
    const host = document.getElementById('site-nav');
    if (!host) return;
    host.textContent = '';
    const links = [
      { label: '홈', url: 'index.html', key: 'home' },
      { label: '주보', url: 'bulletin.html', key: 'bulletin' },
      { label: '교회 일정', url: 'calendar.html', key: 'calendar' },
      { label: '헌금명단', url: 'offering.html', key: 'offering' }
    ].concat((settings.menu || []).filter((m) => m && m.label && m.url));
    const nav = el('nav', { class: 'nav-links', id: 'nav-links' }, links.map((m) => {
      const url = safeUrl(m.url);
      const ext = isExternal(url);
      return el('a', { href: url, class: m.key === active ? 'on' : '', target: ext ? '_blank' : null, rel: ext ? 'noopener' : null }, m.label);
    }));
    const toggle = el('button', { class: 'nav-toggle', type: 'button', 'aria-label': '메뉴 열기', 'aria-expanded': 'false', onclick: () => {
      const open = host.classList.toggle('open');
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    } }, el('span'), el('span'), el('span'));
    host.appendChild(el('div', { class: 'nav-inner' },
      el('a', { class: 'brand', href: 'index.html', 'aria-label': settings.church.name + ' 홈' },
        el('img', { src: 'assets/logo-mark.png', alt: '', width: 28, height: 32 }),
        el('span', { class: 'brand-name' }, el('b', null, '성림'), el('i', null, '교회'))),
      toggle, nav));
  }

  // ---------- 하단 정보 ----------
  function renderFooter(settings) {
    const host = document.getElementById('site-footer');
    if (!host) return;
    const c = settings.church;
    host.textContent = '';
    const btns = [];
    if (settings.blogUrl) btns.push(el('a', { href: safeUrl(settings.blogUrl), target: '_blank', rel: 'noopener' }, '교회 블로그'));
    if (settings.youtube.channelUrl) btns.push(el('a', { href: safeUrl(settings.youtube.channelUrl), target: '_blank', rel: 'noopener' }, '교회 유튜브'));
    if (settings.instagram.username) btns.push(el('a', { href: 'https://www.instagram.com/' + encodeURIComponent(settings.instagram.username) + '/', target: '_blank', rel: 'noopener' }, '인스타그램'));
    host.appendChild(el('div', { class: 'footer-inner' },
      el('img', { class: 'footer-logo', src: 'assets/logo-white.png', alt: c.name + ' — ' + c.slogan, width: 220, height: 76 }),
      btns.length ? el('div', { class: 'footer-btns' }, btns) : null,
      el('ul', { class: 'footer-times' }, (settings.services || []).map((s) =>
        el('li', null, s.name + ' : ' + s.time + (s.place ? ' / ' + s.place : '')))),
      el('div', { class: 'footer-info' },
        c.pastor ? el('p', null, '담임목사: ' + c.pastor) : null,
        c.elders ? el('p', null, '시무장로: ' + c.elders) : null,
        c.phone ? el('p', null, '전화번호: ', el('a', { href: 'tel:' + c.phone.replace(/[^0-9+]/g, '') }, c.phone)) : null,
        c.address ? el('p', null, '주소: ' + c.address) : null),
      el('p', { class: 'footer-copy' }, '© ' + new Date().getFullYear() + ' ' + c.name)));
  }

  // 일정 날짜 표시: 12/13, 여러 날이면 8/1~8/3
  function eventDay(e) {
    const md = (s) => { const d = D.parse(s); return (d.getMonth() + 1) + '/' + d.getDate(); };
    return md(e.date) + (e.endDate && e.endDate > e.date ? '~' + md(e.endDate) : '');
  }
  // from 부터 weeks 주 동안의 일정을 날짜순으로
  function eventsInRange(events, from, weeks) {
    const to = D.add(from, 7 * weeks);
    return (events || []).filter((e) => (e.endDate || e.date) >= from && e.date <= to)
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  // 글자 크기 고르기(보통·크게·아주 크게). 고른 크기는 이 기기에 기억해 둠.
  function setupSizeBar() {
    const bar = document.getElementById('sizebar');
    if (!bar) return;
    const KEY = 'sunglim-text-size';
    const apply = (n) => {
      document.body.dataset.bsize = String(n);
      bar.querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.size === String(n) ? 'true' : 'false'));
    };
    let saved = 0;
    try { saved = Math.max(0, Math.min(2, +localStorage.getItem(KEY) || 0)); } catch (e) { /* 저장소를 못 쓰면 보통 크기 */ }
    apply(saved);
    bar.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      apply(+b.dataset.size);
      try { localStorage.setItem(KEY, b.dataset.size); } catch (e) { /* 무시 */ }
    }));
  }

  window.App = { el, safeUrl, isExternal, calliSrc, setupSizeBar, eventDay, eventsInRange, D, renderNav, renderFooter };
})();
