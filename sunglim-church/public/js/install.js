// 스마트폰에서 "홈 화면에 추가" 안내를 한 번 보여 줍니다. (메뉴에는 넣지 않음)
// 추가했거나 닫으면 그 폰에서는 다시 나오지 않습니다.
(function () {
  const KEY = 'sunglim-home-icon'; // 'done' 또는 지금까지 보여 준 횟수
  const ua = navigator.userAgent || '';
  const isIOS = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isOtherInApp = /NAVER\(inapp|Instagram|FBAN|FBAV|Line\/|DaumApps|everytimeApp/i.test(ua);
  const standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;

  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    navigator.serviceWorker.register('/sw.js').catch(function () { /* 없어도 사이트는 정상 동작 */ });
  }
  if (standalone || !(isIOS || isAndroid)) return; // 이미 홈 화면에서 열었거나 PC

  let seen;
  try { seen = localStorage.getItem(KEY); } catch (e) { return; } // 기억할 수 없는 환경에서는 조르지 않음
  if (seen === 'done' || +seen >= 3) return; // 못 보고 지나친 경우를 생각해 최대 3번까지만
  const remember = function (v) { try { localStorage.setItem(KEY, v); } catch (e) { /* 무시 */ } };

  let box = null;
  function close(done) {
    if (done) remember('done');
    if (box) { box.remove(); box = null; }
  }
  function show(text, actionLabel, onAction) {
    if (box) return;
    remember(String((+seen || 0) + 1));
    const el = function (tag, cls, txt) { const n = document.createElement(tag); if (cls) n.className = cls; if (txt) n.textContent = txt; return n; };
    box = el('div', 'a2hs');
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-label', '홈 화면에 추가');
    const icon = el('img'); icon.src = '/assets/icon-192.png'; icon.alt = ''; icon.width = 44; icon.height = 44;
    const body = el('div', 'a2hs-body');
    body.appendChild(el('b', null, '성림교회를 홈 화면에 추가'));
    body.appendChild(el('span', null, text));
    const x = el('button', 'a2hs-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', '닫기');
    x.addEventListener('click', function () { close(true); });
    box.appendChild(icon); box.appendChild(body);
    if (actionLabel) {
      const go = el('button', 'a2hs-go', actionLabel); go.type = 'button';
      go.addEventListener('click', onAction);
      box.appendChild(go);
    }
    box.appendChild(x);
    document.body.appendChild(box);
  }

  // 카카오톡 안에서 연 경우: 홈 화면 추가가 안 되므로 기본 브라우저로 열도록 안내
  if (isKakao) {
    setTimeout(function () {
      show('카카오톡 안에서는 추가할 수 없어요. 기본 브라우저로 열어 주세요.', '브라우저로 열기', function () {
        close(true);
        location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href);
      });
    }, 1200);
    return;
  }
  if (isOtherInApp) {
    setTimeout(function () { show(isIOS ? '사파리에서 이 주소를 열면 추가할 수 있어요.' : '크롬에서 이 주소를 열면 추가할 수 있어요.'); }, 1200);
    return;
  }

  if (isIOS) {
    // 아이폰은 사이트가 대신 추가해 줄 수 없어서 방법을 알려 줌
    setTimeout(function () {
      show('아래 공유 버튼(네모에 화살표)을 누르고 ‘홈 화면에 추가’를 선택하세요.', '알겠어요', function () { close(true); });
    }, 1200);
    return;
  }

  // 안드로이드(크롬·삼성 인터넷): 브라우저가 "추가할 수 있다"고 알려 주면 버튼을 보여 줌
  let promptEvent = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    promptEvent = ev;
    show('주보를 앱처럼 바로 열 수 있어요.', '추가', function () {
      const ev2 = promptEvent;
      close(true);
      if (ev2 && ev2.prompt) ev2.prompt();
    });
  });
  window.addEventListener('appinstalled', function () { close(true); });
})();
