// 헌금명단 페이지: 비밀번호를 넣어야 명단을 서버에서 받아올 수 있습니다.
(function () {
  const { el, D, renderNav, renderFooter, setupSizeBar } = window.App;
  const $ = (id) => document.getElementById(id);
  let settings = null;

  function showLock(message) {
    $('unlocked').hidden = true;
    $('lock').hidden = false;
    const err = $('lock-err');
    err.hidden = !message;
    err.textContent = message || '';
    $('lock-pw').value = '';
    $('lock-pw').focus();
  }

  function render(data) {
    const host = $('offering');
    host.textContent = '';
    host.appendChild(el('section', { class: 'b-cover' },
      el('h1', { class: 'b-issue' }, data.date ? [data.issue, D.dot(data.date)].filter(Boolean).join(' ') : '헌금명단')));
    const list = (data.offerings || []).filter((o) => (o.names || '').trim()); // 이름이 없는 헌금 종류는 숨김
    host.appendChild(el('section', { class: 'b-sec b-offer' },
      el('h2', { class: 'b-title' }, '주님께 드린 예물'),
      list.length
        ? list.map((o) => el('div', { class: 'b-off' }, el('h3', null, '[' + o.category + ']'), el('p', null, o.names)))
        : el('p', { class: 'b-off-empty' }, data.date ? '이번 주 명단이 아직 올라오지 않았습니다.' : '아직 올라온 명단이 없습니다.'),
      settings.church.account ? el('p', { class: 'b-account', style: 'margin-top:1.4em' }, '온라인 헌금 계좌', el('br'), settings.church.account) : null));

    const sel = $('archive-select');
    sel.textContent = '';
    (data.list || []).forEach((x) => sel.appendChild(el('option', { value: x.date, selected: x.date === data.date }, D.dot(x.date) + ' ' + (x.issue || ''))));
    const many = (data.list || []).length > 1;
    sel.hidden = !many;
    document.querySelector('#archive label').hidden = !many;
  }

  async function load(date) {
    try {
      render(await Store.offering.get(date));
      $('lock').hidden = true;
      $('unlocked').hidden = false;
    } catch (e) {
      if (e && e.status === 401) { Store.offering.signOut(); return showLock(''); } // 열람 기간이 끝났으면 다시 입력
      showLock('명단을 불러오지 못했습니다. 잠시 후 다시 해 주세요.');
    }
  }

  async function main() {
    try { settings = await Store.getSettings(); }
    catch (e) { settings = JSON.parse(JSON.stringify(window.SEED.settings)); }
    renderNav(settings, 'offering');
    renderFooter(settings);
    setupSizeBar();

    $('lock-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('lock-btn');
      btn.disabled = true;
      try {
        await Store.offering.signIn($('lock-pw').value.trim());
        await load();
      } catch (e) {
        showLock(e && e.status === 429 ? '시도가 너무 많습니다. 1분 뒤에 다시 해 주세요.'
          : e && e.status === 401 ? '비밀번호가 맞지 않습니다.'
          : (e && e.status === 503 && e.message) || '확인하지 못했습니다. 잠시 후 다시 해 주세요.');
      }
      btn.disabled = false;
    });
    $('archive-select').addEventListener('change', () => load($('archive-select').value));
    $('lock-again').addEventListener('click', () => { Store.offering.signOut(); $('offering').textContent = ''; showLock(''); });

    if (Store.offering.restore()) load(); else showLock('');
  }
  main();
})();
