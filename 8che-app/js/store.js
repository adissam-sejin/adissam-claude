/* 로그인·저장 계층. Supabase 설정이 있으면 서버 저장, 없으면 데모 모드(localStorage). */
(function () {
  const cfg = window.C8_CONFIG || {};
  const live = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY);
  const ls = {
    get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } },
    set(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const empty = () => ({ constitution: null, source: null, scores: null, answers: null, tested_at: null, meals_per_day: 3, plan_seed: 1, history: [] });
  let sb = null, listeners = [];
  const S = {
    mode: live ? 'supabase' : 'local', local: !live, user: null, profile: null, ready: false,
    onChange(cb) { listeners.push(cb); },
    emit() { listeners.forEach(cb => cb()); },
    guest: () => ls.get('c8.guest'),
    setGuest(r) { ls.set('c8.guest', r); },

    async init() {
      if (live) {
        await new Promise((ok, fail) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js'; s.onload = ok; s.onerror = fail; document.head.appendChild(s); });
        sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, { auth: { flowType: 'pkce', detectSessionInUrl: true, persistSession: true } });
        const { data } = await sb.auth.getSession();
        await S._setSession(data.session);
        sb.auth.onAuthStateChange((ev, session) => { if (ev === 'SIGNED_IN' || ev === 'SIGNED_OUT') setTimeout(async () => { await S._setSession(session); S.emit(); }, 0); });
      } else {
        // 로컬 모드: 가입 없이 이 브라우저에만 저장 (이전 체험 계정 데이터가 있으면 이어받음)
        const old = ls.get('c8.demoUser');
        S.user = { id: 'local', name: '내 정보', provider: 'local' };
        S.profile = Object.assign(empty(), ls.get('c8.demo.local') || (old && ls.get('c8.demo.' + old.id)));
        await S._adoptGuest();
      }
      S.ready = true;
    },
    async _setSession(session) {
      if (!session) { S.user = null; S.profile = null; return; }
      if (S.user && S.user.id === session.user.id && S.profile) return;
      const m = session.user.user_metadata || {}, am = session.user.app_metadata || {};
      S.user = { id: session.user.id, name: m.name || m.nickname || m.full_name || m.preferred_username || '회원', provider: (am.provider || '').replace('custom:', '') };
      await S._load();
      await S._adoptGuest();
    },
    async _load() {
      const p = empty();
      const { data: row } = await sb.from('profiles').select('*').eq('user_id', S.user.id).maybeSingle();
      if (row) Object.assign(p, { constitution: row.constitution, source: row.source, scores: row.scores, answers: row.answers, tested_at: row.tested_at, meals_per_day: row.meals_per_day || 3, plan_seed: row.plan_seed || 1 });
      const { data: hist } = await sb.from('test_history').select('constitution, top_pct, source, created_at').eq('user_id', S.user.id).order('created_at', { ascending: false }).limit(20);
      p.history = hist || [];
      S.profile = p;
    },
    async _persist(historyEntry) {
      const p = S.profile;
      if (live) {
        const { error } = await sb.from('profiles').upsert({ user_id: S.user.id, nickname: S.user.name, provider: S.user.provider, constitution: p.constitution, source: p.source, scores: p.scores, answers: p.answers, tested_at: p.tested_at, meals_per_day: p.meals_per_day, plan_seed: p.plan_seed, updated_at: new Date().toISOString() });
        if (error) throw error;
        if (historyEntry) { const { error: e2 } = await sb.from('test_history').insert(Object.assign({ user_id: S.user.id }, historyEntry)); if (e2) throw e2; }
      } else ls.set('c8.demo.' + S.user.id, p);
    },
    async _adoptGuest() {
      const g = S.guest();
      if (g && S.user) { await S.saveResult(g); S.setGuest(null); }
    },

    async signIn(provider) {
      if (live) {
        const { error } = await sb.auth.signInWithOAuth({ provider: provider === 'naver' ? cfg.NAVER_PROVIDER : cfg.KAKAO_PROVIDER, options: { redirectTo: location.origin + location.pathname } });
        if (error) throw error;
        return;
      }
      S.user = { id: 'demo-' + provider, name: (provider === 'naver' ? '네이버' : '카카오') + ' 체험 회원', provider };
      ls.set('c8.demoUser', S.user);
      S.profile = Object.assign(empty(), ls.get('c8.demo.' + S.user.id));
      await S._adoptGuest();
      S.emit();
    },
    async signOut() {
      if (live) await sb.auth.signOut(); else ls.set('c8.demoUser', null);
      S.user = null; S.profile = null; S.emit();
    },
    // result: { constitution, source, scores, answers, tested_at }
    async saveResult(r) {
      if (!S.user) { S.setGuest(r); return; }
      Object.assign(S.profile, r);
      const h = { constitution: r.constitution, top_pct: r.scores ? r.scores[0].pct : null, source: r.source, created_at: r.tested_at };
      S.profile.history = [h].concat(S.profile.history || []).slice(0, 20);
      await S._persist(h);
    },
    async saveSettings(patch) { Object.assign(S.profile, patch); await S._persist(); },
    async deleteData() {
      if (live) { await sb.from('test_history').delete().eq('user_id', S.user.id); await sb.from('profiles').delete().eq('user_id', S.user.id); }
      else ls.set('c8.demo.' + S.user.id, null);
      S.profile = empty();
    },
    // 현재 보여줄 결과: 로그인 시 계정, 아니면 비회원 임시 결과
    current() { return S.user ? (S.profile && S.profile.constitution ? S.profile : null) : S.guest(); },
  };
  window.C8.store = S;
})();
