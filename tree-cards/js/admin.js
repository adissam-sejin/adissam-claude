/* 관리자 화면: 나무 생성·수정·삭제, 카드 수 확인 */
(function () {
  const $ = (id) => document.getElementById(id);
  const API = window.TreeAPI, THEMES = window.TreeView.THEMES;
  const PW_KEY = "tree-cards-admin-pw";

  let pw = "", trees = [], editing = null;

  if (!API.LIVE) {
    $("previewBanner").hidden = false;
    $("previewPw").textContent = window.TREE_CONFIG.PREVIEW_ADMIN_PASSWORD;
  }

  const fmt = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric", month: "numeric", day: "numeric", hour: "numeric", minute: "2-digit",
  });

  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // datetime-local <-> ISO
  function toInput(iso) {
    if (!iso) return "";
    const d = new Date(iso), p = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
  }
  const toIso = (v) => (v ? new Date(v).toISOString() : null);

  function stateOf(t) {
    const now = Date.now();
    if (t.start_at && now < new Date(t.start_at).getTime()) return ["before", "시작 전"];
    if (t.end_at && now > new Date(t.end_at).getTime()) return ["after", "마감"];
    return ["open", "작성 가능"];
  }
  function periodText(t) {
    if (t.start_at && t.end_at) return fmt.format(new Date(t.start_at)) + " ~ " + fmt.format(new Date(t.end_at));
    if (t.start_at) return fmt.format(new Date(t.start_at)) + "부터";
    if (t.end_at) return fmt.format(new Date(t.end_at)) + "까지";
    return "기간 제한 없음";
  }
  // 나무마다 주소가 따로 있어야 홈 화면 앱으로 각각 저장된다
  const linkOf = (code) => new URL(
    API.LIVE ? "/t/" + encodeURIComponent(code) + "/" : "/index.html?code=" + encodeURIComponent(code),
    location.href).href;

  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }

  /* ---------- 목록 ---------- */
  function draw() {
    const total = trees.reduce((n, t) => n + Number(t.card_count), 0);
    $("statTrees").textContent = trees.length.toLocaleString("ko-KR");
    $("statCards").textContent = total.toLocaleString("ko-KR");
    $("statOpen").textContent = trees.filter((t) => stateOf(t)[0] === "open").length;
    $("noTrees").hidden = trees.length > 0;

    const list = $("treeList");
    list.textContent = "";
    trees.forEach((t) => {
      const th = THEMES[t.theme], [st, stLabel] = stateOf(t);
      const row = h("article", "tree-row");

      const main = h("div", "tree-main");
      const title = h("h3");
      title.append(h("span", "tree-emoji", th.emoji), document.createTextNode(t.name));
      const meta = h("p", "tree-meta");
      meta.append(h("code", "code", t.code), h("span", "tag", th.label), h("span", "state " + st, stLabel));
      main.append(title, meta, h("p", "tree-period", "작성 기간 · " + periodText(t)));

      const count = h("div", "tree-count");
      count.append(h("b", null, Number(t.card_count).toLocaleString("ko-KR")), h("span", null, "카드"));

      const actions = h("div", "tree-actions");
      const open = h("a", "btn", "열기");
      open.href = linkOf(t.code);
      open.target = "_blank";
      open.rel = "noopener";
      const copy = h("button", "btn", "링크 복사");
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(linkOf(t.code)); toast("링크를 복사했어요."); }
        catch (_) { prompt("아래 링크를 복사하세요.", linkOf(t.code)); }
      });
      const cardsBtn = h("button", "btn", "카드 관리");
      cardsBtn.addEventListener("click", () => openCards(t));
      const edit = h("button", "btn", "수정");
      edit.addEventListener("click", () => startEdit(t));
      const del = h("button", "btn danger", "삭제");
      del.addEventListener("click", async () => {
        if (!confirm(`'${t.name}' 나무와 카드 ${t.card_count}개를 모두 삭제할까요?\n삭제하면 되돌릴 수 없어요.`)) return;
        try {
          await API.adminDeleteTree(pw, t.code);
          if (editing === t.code) resetForm();
          toast("나무를 삭제했어요.");
          await refresh();
        } catch (ex) { toast(ex.message); }
      });
      [copy, cardsBtn, edit, del].forEach((b) => (b.type = "button"));
      actions.append(open, copy, cardsBtn, edit, del);

      row.append(main, count, actions);
      list.appendChild(row);
    });
  }

  async function refresh() {
    trees = await API.adminListTrees(pw);
    draw();
  }

  /* ---------- 생성 / 수정 ---------- */
  function genCode() {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const buf = new Uint32Array(6);
    crypto.getRandomValues(buf);
    return Array.from(buf, (n) => chars[n % chars.length]).join("");
  }

  function resetForm() {
    editing = null;
    $("treeForm").reset();
    $("fCode").disabled = false;
    $("genBtn").disabled = false;
    $("formTitle").textContent = "새 나무 만들기";
    $("saveBtn").textContent = "나무 만들기";
    $("cancelEditBtn").hidden = true;
    $("formError").textContent = "";
  }

  function startEdit(t) {
    editing = t.code;
    $("fCode").value = t.code;
    $("fCode").disabled = true;
    $("genBtn").disabled = true;
    $("fName").value = t.name;
    document.querySelector(`input[name="theme"][value="${t.theme}"]`).checked = true;
    $("fStart").value = toInput(t.start_at);
    $("fEnd").value = toInput(t.end_at);
    $("formTitle").textContent = `나무 수정 · ${t.code}`;
    $("saveBtn").textContent = "수정 내용 저장";
    $("cancelEditBtn").hidden = false;
    $("formError").textContent = "";
    $("formTitle").scrollIntoView({ behavior: "smooth", block: "start" });
    $("fName").focus({ preventScroll: true });
  }

  $("genBtn").addEventListener("click", () => { $("fCode").value = genCode(); });
  $("fCode").addEventListener("input", (e) => { e.target.value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ""); });
  $("cancelEditBtn").addEventListener("click", resetForm);

  $("treeForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("formError");
    const t = {
      code: API.normCode($("fCode").value),
      name: $("fName").value.trim(),
      theme: document.querySelector('input[name="theme"]:checked').value,
      start_at: toIso($("fStart").value),
      end_at: toIso($("fEnd").value),
    };
    err.textContent = "";
    if (!/^[A-Z0-9]{4,12}$/.test(t.code)) { err.textContent = "코드는 영문 대문자·숫자 4~12자로 입력해 주세요. (자동 생성 버튼을 눌러도 돼요)"; return; }
    if (!t.name) { err.textContent = "나무 이름을 입력해 주세요."; $("fName").focus(); return; }
    const btn = $("saveBtn");
    btn.disabled = true;
    try {
      const wasEdit = !!editing;
      await API.adminSaveTree(pw, t, !wasEdit);
      resetForm();
      await refresh();
      toast(wasEdit ? "수정 내용을 저장했어요." : `나무를 만들었어요. 코드: ${t.code}`);
    } catch (ex) {
      err.textContent = ex.message;
    } finally {
      btn.disabled = false;
    }
  });

  /* ---------- 카드 관리 ---------- */
  async function openCards(t) {
    const dlg = $("cardsDialog"), ul = $("cardsList");
    $("cardsTitle").textContent = `${THEMES[t.theme].emoji} ${t.name}`;
    ul.textContent = "";
    $("noCards").hidden = true;
    dlg.showModal();
    try {
      const data = await API.getTree(t.code);
      $("noCards").hidden = data.cards.length > 0;
      data.cards.slice().reverse().forEach((c) => {
        const li = h("li");
        const txt = h("div");
        txt.append(h("b", null, c.author), h("small", null, fmt.format(new Date(c.created_at))), h("p", null, c.body));
        const del = h("button", "btn danger", "삭제");
        del.type = "button";
        del.addEventListener("click", async () => {
          if (!confirm(`${c.author}님의 카드를 삭제할까요?`)) return;
          try {
            await API.adminDeleteCard(pw, c.id);
            li.remove();
            $("noCards").hidden = ul.children.length > 0;
            await refresh();
          } catch (ex) { toast(ex.message); }
        });
        li.append(txt, del);
        ul.appendChild(li);
      });
    } catch (ex) { toast(ex.message); }
  }
  $("cardsClose").addEventListener("click", () => $("cardsDialog").close());
  $("cardsDialog").addEventListener("click", (e) => { if (e.target === e.currentTarget) e.currentTarget.close(); });

  /* ---------- 로그인 ---------- */
  async function login(candidate, silent) {
    try {
      trees = await API.adminListTrees(candidate);
      pw = candidate;
      try { sessionStorage.setItem(PW_KEY, pw); } catch (_) {}
      $("login").hidden = true;
      $("dash").hidden = false;
      draw();
    } catch (ex) {
      try { sessionStorage.removeItem(PW_KEY); } catch (_) {}
      $("dash").hidden = true;
      $("login").hidden = false;
      if (!silent) $("loginError").textContent = ex.message;
    }
  }

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    $("loginError").textContent = "";
    login($("pwInput").value, false);
  });
  $("logoutBtn").addEventListener("click", () => {
    try { sessionStorage.removeItem(PW_KEY); } catch (_) {}
    pw = "";
    $("pwInput").value = "";
    $("dash").hidden = true;
    $("login").hidden = false;
  });

  let saved = "";
  try { saved = sessionStorage.getItem(PW_KEY) || ""; } catch (_) {}
  if (saved) login(saved, true);
  else $("login").hidden = false;
})();
