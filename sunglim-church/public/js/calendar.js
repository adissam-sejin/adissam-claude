// 교회 일정 달력
(function () {
  const { el, D, renderNav, renderFooter, eventDay } = window.App;
  const $ = (id) => document.getElementById(id);
  const WEEK = ['일', '월', '화', '수', '목', '금', '토'];
  const pad = (n) => (n < 10 ? '0' : '') + n;
  let events = [];
  let year, month; // month: 1~12

  const eventsOn = (iso) => events.filter((e) => e.date <= iso && iso <= (e.endDate || e.date));

  function draw() {
    const today = D.today();
    const first = new Date(year, month - 1, 1), days = new Date(year, month, 0).getDate();
    const monthStart = year + '-' + pad(month) + '-01', monthEnd = year + '-' + pad(month) + '-' + pad(days);
    $('cal-month').textContent = year + '년 ' + month + '월';

    // 달력 칸
    const grid = $('cal-grid');
    grid.textContent = '';
    grid.appendChild(el('div', { class: 'cal-row cal-week', role: 'row' }, WEEK.map((w, i) => el('div', { role: 'columnheader', class: i === 0 ? 'sun' : i === 6 ? 'sat' : '' }, w))));
    let row = el('div', { class: 'cal-row', role: 'row' });
    for (let i = 0; i < first.getDay(); i++) row.appendChild(el('div', { class: 'cal-cell empty', role: 'gridcell' }));
    for (let d = 1; d <= days; d++) {
      const iso = year + '-' + pad(month) + '-' + pad(d);
      const dow = new Date(year, month - 1, d).getDay();
      const list = eventsOn(iso);
      const cls = 'cal-cell' + (dow === 0 ? ' sun' : dow === 6 ? ' sat' : '') + (iso === today ? ' today' : '') + (list.length ? ' has' : '');
      const inner = [el('span', { class: 'cal-num' }, d),
        list.length ? el('span', { class: 'cal-dots', 'aria-hidden': 'true' }, list.slice(0, 3).map(() => el('i'))) : null,
        list.length ? el('span', { class: 'cal-chips' }, list.slice(0, 3).map((e) => el('span', null, e.title)), list.length > 3 ? el('span', { class: 'more' }, '+' + (list.length - 3)) : null) : null];
      // 일정이 있는 날은 누르면 아래 목록의 그 일정으로 이동
      const cell = list.length
        ? el('button', { type: 'button', class: cls, role: 'gridcell', 'aria-label': month + '월 ' + d + '일, 일정 ' + list.length + '건: ' + list.map((e) => e.title).join(', '), onclick: () => {
            const target = document.getElementById('ev-' + list[0].id);
            if (!target) return;
            document.querySelectorAll('.cal-list li.on').forEach((n) => n.classList.remove('on'));
            list.forEach((e) => { const n = document.getElementById('ev-' + e.id); if (n) n.classList.add('on'); });
            target.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } }, inner)
        : el('div', { class: cls, role: 'gridcell' }, inner);
      row.appendChild(cell);
      if (dow === 6) { grid.appendChild(row); row = el('div', { class: 'cal-row', role: 'row' }); }
    }
    if (row.children.length) {
      while (row.children.length < 7) row.appendChild(el('div', { class: 'cal-cell empty', role: 'gridcell' }));
      grid.appendChild(row);
    }

    // 이번 달 일정 목록
    const list = events.filter((e) => e.date <= monthEnd && (e.endDate || e.date) >= monthStart);
    $('cal-list-title').textContent = month + '월 일정' + (list.length ? ' ' + list.length + '건' : '');
    const ul = $('cal-list');
    ul.textContent = '';
    if (!list.length) ul.appendChild(el('li', { class: 'none' }, '이번 달에는 등록된 일정이 없습니다.'));
    list.forEach((e) => {
      const d = D.parse(e.date);
      ul.appendChild(el('li', { id: 'ev-' + e.id, class: (e.endDate || e.date) < today ? 'past' : '' },
        el('span', { class: 'cal-date' + (d.getDay() === 0 ? ' sun' : '') }, el('b', null, eventDay(e)), el('small', null, WEEK[d.getDay()] + '요일')),
        el('span', { class: 'cal-what' }, el('b', null, e.title), e.time ? el('small', null, e.time) : null)));
    });
  }

  function go(delta) {
    month += delta;
    if (month < 1) { month = 12; year--; }
    if (month > 12) { month = 1; year++; }
    draw();
  }

  async function main() {
    const now = new Date();
    const want = (new URLSearchParams(location.search).get('m') || '').match(/^(\d{4})-(\d{1,2})$/);
    year = want ? +want[1] : now.getFullYear();
    month = want && +want[2] >= 1 && +want[2] <= 12 ? +want[2] : now.getMonth() + 1;

    let settings;
    try { settings = await Store.getSettings(); }
    catch (e) { settings = JSON.parse(JSON.stringify(window.SEED.settings)); }
    renderNav(settings, 'calendar');
    renderFooter(settings);
    $('cal-prev').addEventListener('click', () => go(-1));
    $('cal-next').addEventListener('click', () => go(1));
    $('cal-today').addEventListener('click', () => { const t = new Date(); year = t.getFullYear(); month = t.getMonth() + 1; draw(); });
    draw(); // 달력 틀을 먼저 보여 주고
    try { events = await Store.getEvents(); draw(); }
    catch (e) { $('cal-list').textContent = ''; $('cal-list').appendChild(el('li', { class: 'none' }, '일정을 불러오지 못했습니다. 잠시 후 다시 열어 주세요.')); }
  }
  main();
})();
