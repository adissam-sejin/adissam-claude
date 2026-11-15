/* 사용자 화면: 코드 입력 → 나무 보기 → 카드 쓰기 */
(function () {
  const $ = (id) => document.getElementById(id);
  const API = window.TreeAPI, View = window.TreeView;
  const LIST_PAGE = 20;

  let tree = null, cards = [], theme = null, listShown = LIST_PAGE, pollTimer = null, mine = [];

  if (!API.LIVE) $("previewBanner").hidden = false;

  /* ---------- 날짜 ---------- */
  const fmt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "long", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const fmtDay = new Intl.DateTimeFormat("ko-KR", { year: "numeric", month: "long", day: "numeric" });

  function status() {
    const now = Date.now();
    if (tree.start_at && now < new Date(tree.start_at).getTime()) return "before";
    if (tree.end_at && now > new Date(tree.end_at).getTime()) return "after";
    return "open";
  }

  /* ---------- 떨어지는 눈/잎/꽃잎 ---------- */
  function fillSky(kind) {
    const sky = $("sky");
    sky.textContent = "";
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const n = window.innerWidth < 700 ? 16 : 28;
    for (let i = 0; i < n; i++) {
      const s = document.createElement("span");
      s.className = "flake flake-" + kind;
      const size = 3 + Math.random() * 6;
      s.style.cssText =
        `left:${Math.random() * 100}%;width:${size}px;height:${size}px;` +
        `animation-duration:${8 + Math.random() * 10}s;animation-delay:${-Math.random() * 18}s;` +
        `opacity:${0.35 + Math.random() * 0.5}`;
      sky.appendChild(s);
    }
  }

  /* ---------- 화면 그리기 ---------- */
  function drawTree(newId) {
    const scroll = $("stageScroll"), stage = $("stage");
    stage.style.width = "100%";
    const base = scroll.clientWidth;
    const res = View.render($("treeSvg"), tree.theme, cards, {
      stagePx: base, newId, onPick: openCard,
    });
    stage.style.width = res.zoom > 1 ? Math.round(base * res.zoom) + "px" : "100%";
    $("zoomHint").hidden = !(res.zoom > 1);
    if (res.zoom > 1) scroll.scrollLeft = (stage.offsetWidth - base) / 2;
  }

  function drawList() {
    const ul = $("cardList");
    ul.textContent = "";
    const recent = cards.slice().reverse();
    recent.slice(0, listShown).forEach((c) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      const name = document.createElement("b");
      name.textContent = c.author;
      const body = document.createElement("span");
      body.textContent = c.body;
      btn.append(name, body);
      btn.addEventListener("click", () => openCard(c));
      li.appendChild(btn);
      ul.appendChild(li);
    });
    $("emptyText").hidden = cards.length > 0;
    $("moreBtn").hidden = recent.length <= listShown;
  }

  function drawInfo() {
    const st = status();
    const chip = $("statusChip");
    chip.textContent = { before: "시작 전", open: "작성 가능", after: "마감" }[st];
    chip.dataset.state = st;
    $("countNum").textContent = cards.length.toLocaleString("ko-KR");

    let period;
    if (tree.start_at && tree.end_at) period = fmt.format(new Date(tree.start_at)) + " ~ " + fmt.format(new Date(tree.end_at));
    else if (tree.start_at) period = fmt.format(new Date(tree.start_at)) + "부터";
    else if (tree.end_at) period = fmt.format(new Date(tree.end_at)) + "까지";
    else period = "언제든 작성할 수 있어요";
    $("periodText").textContent = period;

    const open = st === "open";
    [$("writeBtn"), $("writeBtnMobile")].forEach((b) => {
      b.textContent = open ? theme.writeBtn : st === "before" ? "아직 작성 기간이 아니에요" : "작성이 마감되었어요";
      b.disabled = !open;
    });
    const note = $("closedNote");
    note.hidden = open;
    note.textContent = st === "before"
      ? fmt.format(new Date(tree.start_at)) + "부터 작성할 수 있어요."
      : st === "after" ? "작성 기간이 끝났지만, 남겨진 메시지는 계속 볼 수 있어요." : "";
  }

  function drawAll(newId) {
    drawInfo();
    drawTree(newId);
    drawList();
  }

  function showTree(data) {
    tree = data.tree;
    cards = data.cards;
    theme = View.THEMES[tree.theme];
    document.body.dataset.theme = tree.theme;
    document.title = tree.name + " · " + theme.label;
    // 홈 화면에 추가하면 이 나무 전용 아이콘·이름으로 저장되도록 맞춘다
    const set = (sel, attr, val) => { const n = document.querySelector(sel); if (n) n.setAttribute(attr, val); };
    set('link[rel="icon"]', "href", `/assets/favicon-${tree.theme}.svg`);
    set('link[rel="apple-touch-icon"]', "href", `/assets/icon-${tree.theme}-180.png`);
    if (API.LIVE) {
      let mf = document.querySelector('link[rel="manifest"]');
      if (!mf) { mf = document.createElement("link"); mf.rel = "manifest"; document.head.appendChild(mf); }
      mf.href = "/manifest.webmanifest?code=" + encodeURIComponent(tree.code);
    }
    set('meta[name="apple-mobile-web-app-title"]', "content", tree.name);
    set('meta[name="theme-color"]', "content", getComputedStyle(document.body).getPropertyValue("--bg-flat").trim());
    $("themeBadge").textContent = theme.label;
    $("treeName").textContent = tree.name;
    $("tagline").textContent = theme.tagline;
    $("countUnit").textContent = theme.unit;
    $("listTitle").textContent = theme.listTitle;
    $("emptyText").textContent = theme.empty;
    $("writeTitle").textContent = theme.writeTitle;
    $("bodyInput").placeholder = theme.placeholder;
    $("submitBtn").textContent = theme.writeBtn;
    $("home").hidden = true;
    $("page").hidden = false;
    fillSky(tree.theme);
    drawAll();
    startPolling();
    showInstall();
  }

  /* ---------- 새 카드 자동 반영 ---------- */
  async function refresh() {
    if (!tree || document.querySelector("#writeModal[open]")) return;
    try {
      const data = await API.getTree(tree.code);
      // 방금 내가 쓴 카드가 응답에 아직 없으면 그대로 붙여 둔다
      const now = Date.now(), ids = new Set(data.cards.map((c) => c.id));
      mine = mine.filter((m) => !ids.has(m.card.id) && now - m.at < 15000);
      const next = data.cards.concat(mine.map((m) => m.card));
      const fresh = next.filter((c) => !cards.some((o) => o.id === c.id));
      const changed = next.length !== cards.length || next.some((c, i) => c.id !== cards[i].id);
      if (data.tree.theme !== tree.theme) { showTree({ tree: data.tree, cards: next }); return; }
      tree = Object.assign(tree, data.tree);
      $("treeName").textContent = tree.name;
      if (changed) {
        cards = next;
        // 새로 달린 카드가 하나면 톡 튀어나오게 보여준다
        drawAll(fresh.length === 1 ? fresh[0].id : undefined);
      } else drawInfo();
    } catch (_) {}
  }

  function startPolling() {
    clearInterval(pollTimer);
    // 실시간 알림이 기본이고, 놓친 경우를 대비해 주기적으로도 확인한다
    pollTimer = setInterval(() => { if (!document.hidden) refresh(); }, 12000);
    let soon;
    API.subscribe(tree.code, () => { clearTimeout(soon); soon = setTimeout(refresh, 250); });
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) refresh(); });

  /* ---------- 홈 화면에 저장 안내 ---------- */
  const ua = navigator.userAgent;
  const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isKakao = /KAKAOTALK/i.test(ua);
  const isInApp = isKakao || /Instagram|FBAN|FBAV|NAVER\(inapp|Line\//i.test(ua);
  const isInstalled = () =>
    window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let installEvent = null, installTimer = null;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault(); // 브라우저 기본 안내 대신 우리 안내 띠를 쓴다
    installEvent = e;
    if (tree) showInstall();
  });
  window.addEventListener("appinstalled", () => { $("installBar").hidden = true; });

  const dismissedKey = () => "tree-cards-install-off:" + tree.code;
  function showInstall() {
    clearTimeout(installTimer);
    const bar = $("installBar");
    bar.hidden = true;
    if (!API.LIVE || isInstalled()) return;
    try { if (localStorage.getItem(dismissedKey())) return; } catch (_) {}

    const btn = $("installBtn"), desc = $("installDesc");
    $("installIcon").src = `/assets/icon-${tree.theme}-192.png`;
    $("installTitle").textContent = "이 나무를 홈 화면에 저장할까요?";
    btn.hidden = false;
    if (isInApp) {
      // 카카오톡 등 앱 안 브라우저에서는 저장이 안 되므로 바깥 브라우저로 보낸다
      $("installTitle").textContent = "홈 화면에 저장하려면 브라우저에서 열어주세요";
      desc.textContent = isKakao ? "버튼을 누르면 기본 브라우저로 열려요." : "메뉴에서 ‘다른 브라우저로 열기’를 눌러주세요.";
      btn.textContent = "브라우저로 열기";
      btn.hidden = !isKakao;
      btn.onclick = () => { location.href = "kakaotalk://web/openExternal?url=" + encodeURIComponent(location.href); };
    } else if (installEvent) {
      desc.textContent = "앱처럼 아이콘으로 바로 열 수 있어요.";
      btn.textContent = "저장";
      btn.onclick = async () => {
        const ev = installEvent;
        installEvent = null;
        ev.prompt();
        try { await ev.userChoice; } catch (_) {}
        bar.hidden = true;
      };
    } else if (isIOS) {
      desc.textContent = "아래(또는 위)의 공유 버튼을 누른 뒤 ‘홈 화면에 추가’를 선택하세요.";
      btn.hidden = true;
    } else if (isAndroid) {
      // 설치 안내 이벤트를 주지 않는 브라우저: 조금 기다려 보고 직접 하는 방법을 알려준다
      installTimer = setTimeout(() => {
        if (installEvent || !tree) return;
        desc.textContent = "브라우저 메뉴(⋮)에서 ‘홈 화면에 추가’를 선택하세요.";
        btn.hidden = true;
        bar.hidden = false;
      }, 3500);
      return;
    } else {
      return; // PC 등: 브라우저가 설치를 지원할 때만(위 installEvent) 보여준다
    }
    bar.hidden = false;
  }
  $("installClose").addEventListener("click", () => {
    $("installBar").hidden = true;
    try { localStorage.setItem(dismissedKey(), "1"); } catch (_) {}
  });
  if (API.LIVE && "serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }

  /* ---------- 메시지 보기 ---------- */
  function openCard(card) {
    $("viewIcon").replaceChildren(View.icon(tree.theme, card));
    $("viewBody").textContent = card.body;
    $("viewAuthor").textContent = card.author;
    $("viewDate").textContent = fmtDay.format(new Date(card.created_at));
    $("viewModal").showModal();
  }

  /* ---------- 메시지 쓰기 ---------- */
  function openWrite() {
    if (status() !== "open") return;
    $("writeError").textContent = "";
    $("writeModal").showModal();
    $("authorInput").focus();
  }

  $("bodyInput").addEventListener("input", () => {
    $("bodyCount").textContent = $("bodyInput").value.length;
  });

  $("writeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const author = $("authorInput").value.trim(), body = $("bodyInput").value.trim();
    const err = $("writeError");
    if (!author) { err.textContent = "이름을 입력해 주세요."; $("authorInput").focus(); return; }
    if (!body) { err.textContent = "내용을 입력해 주세요."; $("bodyInput").focus(); return; }
    const btn = $("submitBtn");
    btn.disabled = true;
    err.textContent = "";
    try {
      const card = await API.addCard(tree.code, author, body);
      cards.push(card);
      mine.push({ card, at: Date.now() });
      $("bodyInput").value = "";
      $("bodyCount").textContent = "0";
      $("writeModal").close();
      listShown = Math.max(listShown, LIST_PAGE);
      drawAll(card.id);
      $("stageScroll").scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (ex) {
      err.textContent = ex.message;
      if (ex.code === "ENDED" || ex.code === "NOT_STARTED") drawInfo();
    } finally {
      btn.disabled = false;
    }
  });

  $("writeBtn").addEventListener("click", openWrite);
  $("writeBtnMobile").addEventListener("click", openWrite);
  $("moreBtn").addEventListener("click", () => { listShown += LIST_PAGE; drawList(); });

  document.querySelectorAll("dialog").forEach((d) => {
    d.addEventListener("click", (e) => {
      if (e.target === d || e.target.closest("[data-close]")) d.close();
    });
  });

  let resizeTimer, lastW = window.innerWidth;
  window.addEventListener("resize", () => {
    if (!tree || window.innerWidth === lastW) return;
    lastW = window.innerWidth;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => drawTree(), 150);
  });

  /* ---------- 코드 입력 ---------- */
  async function enter(code, fromForm) {
    code = API.normCode(code);
    const err = $("codeError");
    err.textContent = "";
    if (!code) { err.textContent = "코드를 입력해 주세요."; return; }
    try {
      const data = await API.getTree(code);
      if (fromForm) {
        // 실서버에서는 나무 전용 주소(/t/코드/)로 이동한다
        if (API.LIVE) { location.assign("/t/" + encodeURIComponent(code) + "/"); return; }
        history.pushState(null, "", "?code=" + encodeURIComponent(code));
      }
      showTree(data);
    } catch (ex) {
      $("page").hidden = true;
      $("home").hidden = false;
      $("codeInput").value = code;
      err.textContent = ex.message;
      fillSky("christmas");
    }
  }

  $("codeForm").addEventListener("submit", (e) => {
    e.preventDefault();
    enter($("codeInput").value, true);
  });
  window.addEventListener("popstate", () => location.reload());

  const inPath = location.pathname.match(/^\/t\/([^/]+)/);
  const initial = inPath ? decodeURIComponent(inPath[1]) : new URLSearchParams(location.search).get("code");
  if (initial) enter(initial, false);
  else { $("home").hidden = false; fillSky("christmas"); }
})();
