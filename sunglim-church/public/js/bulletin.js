// 주보 페이지: 주소에 ?d=2026-11-22 가 있으면 그 날짜, 없으면 가장 최근에 공개된 주보를 보여줍니다.
(function () {
  const { el, D, renderNav, renderFooter } = window.App;
  const host = document.getElementById('bulletin');

  function state(title, msg) {
    host.textContent = '';
    host.className = '';
    host.appendChild(el('p', { class: 'state' }, el('b', null, title), msg));
  }

  async function main() {
    window.App.setupSizeBar();
    const want = new URLSearchParams(location.search).get('d');
    let view;
    try { view = await Store.getView(want && /^\d{4}-\d{2}-\d{2}$/.test(want) ? want : null); }
    catch (e) {
      const fallback = JSON.parse(JSON.stringify(window.SEED.settings));
      renderNav(fallback, 'bulletin'); renderFooter(fallback);
      return state('주보를 불러오지 못했습니다', '잠시 후 다시 열어 주세요.');
    }
    const settings = view.settings, b = view.bulletin;
    renderNav(settings, 'bulletin');
    renderFooter(settings);
    if (!b) return state('아직 올라온 주보가 없습니다', '주일 전에 새 주보가 올라옵니다.');

    BulletinView.render(host, b, view.roster, settings, view.events);

    // PDF로 저장(인쇄 창에서 ‘PDF로 저장’ 선택). 파일 이름이 되도록 제목을 정함
    document.title = settings.church.name + ' 주보 ' + b.date;
    document.getElementById('archive').hidden = false;
    document.getElementById('pdf-btn').addEventListener('click', () => window.print());

    // 지난 주보 선택
    const sel = document.getElementById('archive-select');
    if (view.list.length > 1) {
      view.list.forEach((x) => sel.appendChild(el('option', { value: x.date, selected: x.date === b.date }, D.dot(x.date) + ' ' + (x.issue || ''))));
      sel.addEventListener('change', () => { location.href = 'bulletin.html?d=' + sel.value; });
    } else {
      document.querySelector('#archive label').hidden = true; sel.hidden = true;
    }
  }
  main();
})();
