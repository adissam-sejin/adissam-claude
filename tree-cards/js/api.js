/* 데이터 계층: Supabase(실서버) 또는 localStorage(미리보기) */
(function () {
  const cfg = window.TREE_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);

  const LIMITS = { author: 12, body: 500 };
  const THEME_KEYS = ["christmas", "persimmon", "cherry"];

  const MESSAGES = {
    TREE_NOT_FOUND: "해당 코드의 나무를 찾을 수 없어요. 코드를 다시 확인해 주세요.",
    NOT_STARTED: "아직 작성 기간이 시작되지 않았어요.",
    ENDED: "작성 기간이 끝났어요.",
    BAD_INPUT: "입력 내용을 다시 확인해 주세요.",
    BAD_PASSWORD: "관리자 비밀번호가 올바르지 않아요.",
    CODE_EXISTS: "이미 사용 중인 코드예요. 다른 코드를 입력해 주세요.",
    BAD_CODE: "코드는 영문 대문자·숫자 4~12자로 입력해 주세요.",
    BAD_PERIOD: "종료 일시는 시작 일시보다 뒤여야 해요.",
    NETWORK: "서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.",
  };

  function fail(code) {
    const e = new Error(MESSAGES[code] || code);
    e.code = code;
    return e;
  }

  const normCode = (c) => String(c || "").trim().toUpperCase();

  /* ---------------- Supabase ---------------- */
  async function rpc(fn, args) {
    let res;
    try {
      res = await fetch(cfg.SUPABASE_URL.replace(/\/$/, "") + "/rest/v1/rpc/" + fn, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: cfg.SUPABASE_ANON_KEY,
          Authorization: "Bearer " + cfg.SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(args || {}),
      });
    } catch (_) {
      throw fail("NETWORK");
    }
    let data = null;
    try { data = await res.json(); } catch (_) {}
    if (!res.ok) {
      const msg = data && data.message;
      throw fail(MESSAGES[msg] ? msg : "NETWORK");
    }
    return data;
  }

  const live = {
    getTree: (code) => rpc("get_tree", { p_code: normCode(code) }),
    addCard: (code, author, body) =>
      rpc("add_card", { p_code: normCode(code), p_author: author, p_body: body }),
    adminListTrees: (pw) => rpc("admin_list_trees", { p_pw: pw }),
    adminSaveTree: (pw, t, isNew) =>
      rpc("admin_save_tree", {
        p_pw: pw, p_code: normCode(t.code), p_name: t.name, p_theme: t.theme,
        p_start: t.start_at || null, p_end: t.end_at || null, p_is_new: !!isNew,
      }),
    adminDeleteTree: (pw, code) => rpc("admin_delete_tree", { p_pw: pw, p_code: normCode(code) }),
    adminDeleteCard: (pw, id) => rpc("admin_delete_card", { p_pw: pw, p_id: id }),
  };

  /* ---------------- 미리보기(localStorage) ---------------- */
  const KEY = "tree-cards-preview-db";
  function load() {
    try {
      const db = JSON.parse(localStorage.getItem(KEY));
      if (db && db.trees && db.cards) return db;
    } catch (_) {}
    return { trees: {}, cards: [], seq: 0 };
  }
  function save(db) {
    try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (_) {}
  }
  function checkPw(pw) {
    if (pw !== cfg.PREVIEW_ADMIN_PASSWORD) throw fail("BAD_PASSWORD");
  }
  function validateTree(t) {
    if (!/^[A-Z0-9]{4,12}$/.test(t.code)) throw fail("BAD_CODE");
    if (!t.name || t.name.length > 40 || !THEME_KEYS.includes(t.theme)) throw fail("BAD_INPUT");
    if (t.start_at && t.end_at && new Date(t.end_at) <= new Date(t.start_at)) throw fail("BAD_PERIOD");
  }

  const preview = {
    async getTree(code) {
      const db = load();
      const t = db.trees[normCode(code)];
      if (!t) throw fail("TREE_NOT_FOUND");
      return { tree: t, cards: db.cards.filter((c) => c.tree_code === t.code).map(pub) };
    },
    async addCard(code, author, body) {
      const db = load();
      const t = db.trees[normCode(code)];
      if (!t) throw fail("TREE_NOT_FOUND");
      author = String(author || "").trim();
      body = String(body || "").trim();
      if (!author || !body || author.length > LIMITS.author || body.length > LIMITS.body) throw fail("BAD_INPUT");
      const now = Date.now();
      if (t.start_at && now < new Date(t.start_at).getTime()) throw fail("NOT_STARTED");
      if (t.end_at && now > new Date(t.end_at).getTime()) throw fail("ENDED");
      const card = { id: ++db.seq, tree_code: t.code, author, body, created_at: new Date().toISOString() };
      db.cards.push(card);
      save(db);
      return pub(card);
    },
    async adminListTrees(pw) {
      checkPw(pw);
      const db = load();
      return Object.values(db.trees)
        .sort((a, b) => (a.created_at < b.created_at ? 1 : -1))
        .map((t) => ({ ...t, card_count: db.cards.filter((c) => c.tree_code === t.code).length }));
    },
    async adminSaveTree(pw, t, isNew) {
      checkPw(pw);
      const db = load();
      const tree = {
        code: normCode(t.code), name: String(t.name || "").trim(), theme: t.theme,
        start_at: t.start_at || null, end_at: t.end_at || null,
      };
      validateTree(tree);
      if (isNew) {
        if (db.trees[tree.code]) throw fail("CODE_EXISTS");
        tree.created_at = new Date().toISOString();
      } else {
        if (!db.trees[tree.code]) throw fail("TREE_NOT_FOUND");
        tree.created_at = db.trees[tree.code].created_at;
      }
      db.trees[tree.code] = tree;
      save(db);
      return tree;
    },
    async adminDeleteTree(pw, code) {
      checkPw(pw);
      const db = load();
      code = normCode(code);
      delete db.trees[code];
      db.cards = db.cards.filter((c) => c.tree_code !== code);
      save(db);
      return true;
    },
    async adminDeleteCard(pw, id) {
      checkPw(pw);
      const db = load();
      db.cards = db.cards.filter((c) => c.id !== id);
      save(db);
      return true;
    },
  };
  function pub(c) {
    return { id: c.id, author: c.author, body: c.body, created_at: c.created_at };
  }

  window.TreeAPI = Object.assign({ LIVE, LIMITS, normCode }, LIVE ? live : preview);
})();
