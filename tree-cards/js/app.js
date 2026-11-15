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
  }

  /* ---------- 새 카드 자동 반영 ---------- */
  function startPolling() {
    clearInterval(pollTimer);
    pollTimer = setInterval(async () => {
      if (document.hidden || document.querySelector("dialog[open]")) return;
      try {
        const data = await API.getTree(tree.code);
        // 방금 내가 쓴 카드가 서버 응답(잠깐 캐시됨)에 아직 없으면 그대로 붙여 둔다
        const now = Date.now(), ids = new Set(data.cards.map((c) => c.id));
        mine = mine.filter((m) => !ids.has(m.card.id) && now - m.at < 90000);
        const next = data.cards.concat(mine.map((m) => m.card));
        const changed = next.length !== cards.length || next.some((c, i) => c.id !== cards[i].id) ||
          data.tree.name !== tree.name || data.tree.theme !== tree.theme;
        if (data.tree.theme !== tree.theme) { showTree({ tree: data.tree, cards: next }); return; }
        tree = Object.assign(tree, data.tree);
        $("treeName").textContent = tree.name;
        if (changed) { cards = next; drawAll(); } else drawInfo();
      } catch (_) {}
    }, 15000);
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
      if (fromForm) history.pushState(null, "", "?code=" + encodeURIComponent(code));
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

  const initial = new URLSearchParams(location.search).get("code");
  if (initial) enter(initial, false);
  else { $("home").hidden = false; fillSky("christmas"); }
})();
