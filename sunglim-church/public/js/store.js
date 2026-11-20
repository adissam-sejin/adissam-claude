// 데이터 읽기/쓰기.
// 사이트가 Netlify 에 올라가 있으면 서버(/api)에 저장하고, 아니면(미리보기 모드) 이 브라우저에만 저장합니다.
(function () {
  const cfg = window.SITE_CONFIG || {};
  const api = (cfg.api || '').replace(/\/$/, '');
  const live = !!api;
  const LS_KEY = 'sunglim-demo-v1';
  const SESS_KEY = 'sunglim-admin-session';
  const VIEW_KEY = 'sunglim-offering-session';
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ---------- 미리보기 모드(localStorage) ----------
  function loadLocal() {
    try {
      const s = JSON.parse(localStorage.getItem(LS_KEY));
      if (s && s.settings) return s;
    } catch (e) { /* 저장소를 못 쓰는 환경이면 기본값 사용 */ }
    return clone(window.SEED);
  }
  function saveLocal(d) {
    try { localStorage.setItem(LS_KEY, JSON.stringify(d)); } catch (e) { /* 무시 */ }
  }
  const newestFirst = (a, b) => (a.date < b.date ? 1 : -1);
  const oldestFirst = (a, b) => (a.date < b.date ? -1 : 1);

  // ---------- 서버(/api) ----------
  let session = null; // 관리자 로그인 정보 {token, exp}
  let viewer = null;  // 헌금명단 열람 정보 {token, exp}
  function keepSession(s) {
    session = s;
    try { s ? localStorage.setItem(SESS_KEY, JSON.stringify(s)) : localStorage.removeItem(SESS_KEY); } catch (e) { /* 무시 */ }
  }
  async function call(path, opts) {
    opts = opts || {};
    const headers = Object.assign({}, opts.headers || {});
    const token = opts.token || (session && session.token);
    if (token) headers.Authorization = 'Bearer ' + token;
    let body = opts.body;
    if (body !== undefined && !(body instanceof Blob)) { headers['Content-Type'] = 'application/json'; body = JSON.stringify(body); }
    const res = await fetch(api + path, { method: opts.method || 'GET', headers, body, cache: 'no-store' });
    let data = null;
    try { data = await res.json(); } catch (e) { /* 본문 없음 */ }
    if (!res.ok) {
      const err = new Error((data && data.message) || String(res.status));
      err.status = res.status;
      throw err;
    }
    return data;
  }

  // 빠진 항목은 기본값으로 채운 설정
  function fillSettings(s) {
    const d = clone(window.SEED.settings);
    if (!s) return d;
    return Object.assign(d, s, {
      church: Object.assign(d.church, s.church || {}),
      youtube: Object.assign(d.youtube, s.youtube || {}),
      instagram: Object.assign(d.instagram, s.instagram || {})
    });
  }

  const Store = {
    live,

    // 관리자 로그인(관리자 페이지에서만 사용)
    auth: {
      async restore() {
        if (!live) return true;
        try { session = JSON.parse(localStorage.getItem(SESS_KEY)); } catch (e) { session = null; }
        if (!session || !session.token || !(session.exp > Date.now())) { keepSession(null); return false; }
        try { await call('/session'); return true; } catch (e) { keepSession(null); return false; }
      },
      async signIn(id, password) {
        keepSession(null);
        keepSession(await call('/login', { method: 'POST', body: { id, password } }));
      },
      signOut() { keepSession(null); }
    },

    // 방문자 화면용: 설정 + 주보(날짜를 주면 그 주보, 없으면 최신) + 명단 + 공개된 주보 목록을 한 번에
    async getView(date) {
      if (live) {
        const v = await call('/view' + (date ? '?d=' + encodeURIComponent(date) : ''));
        return { settings: fillSettings(v.settings), bulletin: v.bulletin, roster: v.roster || [], list: v.list || [] };
      }
      const d = loadLocal();
      const pub = d.bulletins.filter((b) => b.published).sort(newestFirst);
      const b = date ? pub.find((x) => x.date === date) : pub[0];
      return {
        settings: fillSettings(d.settings),
        bulletin: b ? Object.assign(clone(b), { offerings: undefined }) : null,
        roster: d.roster.map(clone).sort(oldestFirst),
        list: pub.map((x) => ({ date: x.date, issue: x.issue, published: true }))
      };
    },

    async getSettings() {
      if (live) return fillSettings((await call('/settings')).data);
      return fillSettings(loadLocal().settings);
    },
    async saveSettings(s) {
      if (live) return call('/settings', { method: 'PUT', body: s });
      const d = loadLocal(); d.settings = clone(s); saveLocal(d);
    },

    // 주보 목록(최신순). 로그인하지 않으면 공개된 주보만 보입니다.
    async listBulletins() {
      if (live) return call('/bulletins');
      return loadLocal().bulletins.map((b) => ({ date: b.date, issue: b.issue, published: b.published })).sort(newestFirst);
    },
    async getBulletin(date) {
      if (live) return call('/bulletins/' + encodeURIComponent(date));
      const b = loadLocal().bulletins.find((x) => x.date === date);
      return b ? clone(b) : null;
    },
    async saveBulletin(b) {
      const row = { date: b.date, issue: b.issue || '', published: !!b.published, content: b.content, offerings: b.offerings || [] };
      if (live) return call('/bulletins/' + encodeURIComponent(b.date), { method: 'PUT', body: row });
      const d = loadLocal();
      d.bulletins = d.bulletins.filter((x) => x.date !== b.date).concat([clone(row)]);
      saveLocal(d);
    },
    async deleteBulletin(date) {
      if (live) return call('/bulletins/' + encodeURIComponent(date), { method: 'DELETE' });
      const d = loadLocal(); d.bulletins = d.bulletins.filter((x) => x.date !== date); saveLocal(d);
    },

    // 대표기도·봉사 명단
    async getRoster() {
      if (live) return call('/roster');
      return loadLocal().roster.map(clone).sort(oldestFirst);
    },
    async saveRoster(rows, deletedDates) {
      rows = rows.map((r) => ({ date: r.date, prayer1: r.prayer1 || '', prayer2: r.prayer2 || '', reader2: r.reader2 || '', dish: r.dish || '' }));
      if (live) return call('/roster', { method: 'POST', body: { rows, deleted: deletedDates || [] } });
      const d = loadLocal();
      const map = {};
      d.roster.forEach((r) => { map[r.date] = r; });
      (deletedDates || []).forEach((dt) => { delete map[dt]; });
      rows.forEach((r) => { map[r.date] = r; });
      d.roster = Object.keys(map).sort().map((k) => map[k]);
      saveLocal(d);
    },

    // 생일 명단(1년치) — 관리자만
    async getBirthdays() {
      if (live) return call('/birthdays');
      return clone(loadLocal().birthdays || []);
    },
    async saveBirthdays(list) {
      if (live) return call('/birthdays', { method: 'PUT', body: list });
      const d = loadLocal(); d.birthdays = clone(list); saveLocal(d);
    },

    // 헌금명단 열람(비밀번호를 넣은 사람만). 명단은 주보와 따로 보관됩니다.
    offering: {
      restore() {
        if (!live) return false;
        try { viewer = JSON.parse(localStorage.getItem(VIEW_KEY)); } catch (e) { viewer = null; }
        if (!viewer || !viewer.token || !(viewer.exp > Date.now())) { viewer = null; return false; }
        return true;
      },
      async signIn(password) {
        viewer = live ? await call('/offerings/login', { method: 'POST', body: { password } }) : { token: 'demo', exp: Date.now() + 3600000 };
        try { if (live) localStorage.setItem(VIEW_KEY, JSON.stringify(viewer)); } catch (e) { /* 무시 */ }
      },
      signOut() { viewer = null; try { localStorage.removeItem(VIEW_KEY); } catch (e) { /* 무시 */ } },
      async get(date) {
        if (live) return call('/offerings' + (date ? '?d=' + encodeURIComponent(date) : ''), { token: viewer && viewer.token });
        const pub = loadLocal().bulletins.filter((b) => b.published).sort(newestFirst);
        const b = date ? pub.find((x) => x.date === date) : pub[0];
        return { date: b ? b.date : null, issue: b ? b.issue : '', offerings: b ? clone(b.offerings || []) : [], list: pub.map((x) => ({ date: x.date, issue: x.issue })) };
      }
    },

    // 이미지 올리기: 서버에 올리고 주소를 돌려줌. 미리보기 모드에서는 글자(data URL)로 돌려줌.
    async uploadImage(blob, name) {
      if (live) {
        const safe = name.replace(/[^\w.-]/g, '') || 'image.png';
        return (await call('/images/' + safe, { method: 'POST', body: blob, headers: { 'Content-Type': blob.type || 'image/png' } })).url;
      }
      return new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(fr.result); fr.onerror = () => reject(new Error('read'));
        fr.readAsDataURL(blob);
      });
    },

    resetDemo() { try { localStorage.removeItem(LS_KEY); } catch (e) { /* 무시 */ } }
  };

  window.Store = Store;
})();
