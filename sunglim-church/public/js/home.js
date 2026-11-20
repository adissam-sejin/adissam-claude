// 홈 화면
(function () {
  const { el, safeUrl, calliSrc, D, renderNav, renderFooter } = window.App;
  const $ = (id) => document.getElementById(id);

  function renderWeek(b) {
    const host = $('week-host');
    if (!b) return;
    const c = b.content || {};
    const s = c.sermon || {};
    host.appendChild(el('section', { class: 'week', 'aria-label': '이번 주 말씀' },
      el('div', { class: 'week-date' }, el('b', null, D.korFull(b.date)), el('span', null, '주일 ' + (b.issue || ''))),
      el('div', { class: 'week-body' },
        el('p', { class: 'week-label' }, '이번 주 말씀'),
        el('h2', { class: 'week-sermon' }, s.title || '주일예배'),
        el('p', { class: 'week-meta' }, [s.scripture, s.preacher].filter(Boolean).join(' · ')),
        c.memory && c.memory.text ? el('p', { class: 'week-memory' }, el('b', null, '암송말씀'), c.memory.text + (c.memory.ref ? ' (' + c.memory.ref + ')' : '')) : null,
        el('div', { class: 'week-btns' }, el('a', { class: 'btn btn-fill', href: 'bulletin.html' }, '주보 전체 보기')))));
  }

  // 유튜브: 채널의 '업로드한 동영상' 재생목록을 넣으면 항상 최신 영상이 먼저 나옵니다.
  function renderVideo(yt) {
    const id = (yt.channelId || '').trim();
    if (!/^UC[\w-]{22}$/.test(id)) return;
    $('video').hidden = false;
    $('video-frame').appendChild(el('iframe', {
      src: 'https://www.youtube.com/embed/videoseries?list=UU' + id.slice(2) + '&rel=0',
      title: '성림교회 최신 영상', loading: 'lazy', allowfullscreen: true,
      allow: 'accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share',
      referrerpolicy: 'strict-origin-when-cross-origin'
    }));
    const more = $('video-more');
    more.href = safeUrl(yt.channelUrl || 'https://www.youtube.com/channel/' + id);
  }

  function renderTimes(list) {
    const host = $('times-list');
    (list || []).filter((s) => s.name).forEach((s) => host.appendChild(el('div', { class: 'time-card' },
      el('div', null, el('h3', null, s.name), el('p', null, s.time)),
      s.place ? el('span', { class: 'time-place' }, s.place) : null)));
    if (!host.children.length) $('times').hidden = true;
  }

  // 인스타그램: 공식 프로필 임베드(최근 게시물이 자동으로 표시됨). 공개 계정이어야 합니다.
  function renderInsta(ig) {
    const user = (ig.username || '').trim().replace(/^@/, '');
    if (!/^[\w.]{1,30}$/.test(user)) return;
    const url = 'https://www.instagram.com/' + user + '/';
    $('insta').hidden = false;
    $('insta-more').href = url;
    $('insta-frame').appendChild(el('blockquote', { class: 'instagram-media', 'data-instgrm-permalink': url, 'data-instgrm-version': '14' },
      el('div', { class: 'insta-fallback' }, el('a', { href: url, target: '_blank', rel: 'noopener' }, '@' + user + ' 인스타그램에서 사진 보기'))));
    document.body.appendChild(el('script', { src: 'https://www.instagram.com/embed.js', async: true }));
  }

  function renderVisit(c) {
    const q = encodeURIComponent(c.address || c.name);
    if (c.address) {
      $('visit-map').appendChild(el('iframe', { src: 'https://maps.google.com/maps?q=' + q + '&z=16&hl=ko&output=embed', title: c.name + ' 지도', loading: 'lazy', referrerpolicy: 'no-referrer-when-downgrade' }));
    } else { $('visit-map').hidden = true; }
    $('visit-info').appendChild(el('div', null,
      el('dl', null,
        c.address ? [el('dt', null, '주소'), el('dd', null, c.address)] : null,
        c.phone ? [el('dt', null, '전화'), el('dd', null, el('a', { href: 'tel:' + c.phone.replace(/[^0-9+]/g, '') }, c.phone))] : null,
        c.pastor ? [el('dt', null, '담임목사'), el('dd', null, c.pastor)] : null),
      el('div', { class: 'visit-btns' },
        el('a', { class: 'btn btn-line', href: 'https://map.naver.com/p/search/' + q, target: '_blank', rel: 'noopener' }, '네이버 지도'),
        el('a', { class: 'btn btn-line', href: 'https://map.kakao.com/?q=' + q, target: '_blank', rel: 'noopener' }, '카카오맵'))));
  }

  async function main() {
    let view;
    try { view = await Store.getView(); }
    catch (e) { view = { settings: JSON.parse(JSON.stringify(window.SEED.settings)), bulletin: null }; } // 서버가 안 될 때도 기본 안내는 보여줌
    const settings = view.settings;
    const c = settings.church;
    document.title = c.name + ' — ' + c.slogan;
    renderNav(settings, 'home');
    $('hero-slogan').textContent = c.slogan;
    $('hero-calli').alt = c.vision;
    if (calliSrc(settings) !== 'assets/calli-white.png') { $('hero-calli').removeAttribute('height'); $('hero-calli').src = calliSrc(settings); }
    $('hero-verse').textContent = c.verse;
    renderWeek(view.bulletin);
    renderVideo(settings.youtube);
    renderTimes(settings.services);
    renderInsta(settings.instagram);
    renderVisit(c);
    renderFooter(settings);
  }
  main();
})();
