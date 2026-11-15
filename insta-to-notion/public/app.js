(function () {
  const $ = (id) => document.getElementById(id);
  const state = { parsed: null, threads: [], selected: new Set(), parentId: '' };

  function setStatus(el, msg, kind) {
    el.textContent = msg;
    el.className = 'status' + (kind ? ' ' + kind : '');
  }
  const fmtDate = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return d.getFullYear() + '.' + (d.getMonth() + 1) + '.' + d.getDate();
  };

  // ---- 1. 노션 연결 ----
  const stored = (k) => { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } };
  $('token').value = stored('ig2notion:token');
  $('page').value = stored('ig2notion:page');
  $('remember').checked = !!$('token').value;

  async function connect() {
    const token = $('token').value.trim();
    const parentId = NotionSync.parsePageId($('page').value);
    if (!token) throw new Error('노션 통합 시크릿을 입력해 주세요.');
    if (!parentId) throw new Error('노션 페이지 링크가 올바르지 않습니다.');
    NotionSync.setToken(token);
    try {
      await NotionSync.call('GET', 'users/me');
    } catch (e) {
      throw new Error(e.status === 401 ? '시크릿이 올바르지 않습니다.' : e.message);
    }
    try {
      await NotionSync.call('GET', 'pages/' + parentId);
    } catch (e) {
      throw new Error(e.status === 404
        ? '페이지를 찾을 수 없습니다. 페이지의 ⋯ → 연결에서 통합을 추가했는지 확인해 주세요.'
        : e.message);
    }
    state.parentId = parentId;
    try {
      localStorage.setItem('ig2notion:page', $('page').value.trim());
      if ($('remember').checked) localStorage.setItem('ig2notion:token', token);
      else localStorage.removeItem('ig2notion:token');
    } catch (e) { /* 저장 불가 환경은 무시 */ }
  }

  $('connect').addEventListener('click', async () => {
    const el = $('connect-status');
    setStatus(el, '확인 중…');
    try {
      await connect();
      setStatus(el, '연결되었습니다.', 'ok');
    } catch (e) {
      setStatus(el, e.message, 'bad');
    }
  });

  // ---- 2. 파일 읽기 ----
  zip.configure({ useWebWorkers: false }); // 워커 스크립트 없이 메인 스레드에서 압축 해제

  async function entriesFromZips(files) {
    const out = [];
    for (const file of files) {
      const reader = new zip.ZipReader(new zip.BlobReader(file));
      for (const entry of await reader.getEntries()) {
        if (entry.directory) continue;
        out.push({ path: entry.filename, text: () => entry.getData(new zip.TextWriter()) });
      }
    }
    return out;
  }

  async function load(entries) {
    const el = $('file-status');
    setStatus(el, '파일을 읽는 중…');
    try {
      const parsed = await IGParser.parseExport(await entries);
      if (!parsed.threads.length && !parsed.saved.length) {
        $('step-preview').hidden = true;
        setStatus(el, parsed.htmlExport
          ? 'HTML 형식으로 내보낸 파일입니다. 형식을 JSON으로 바꿔 다시 내보내 주세요.'
          : '메시지나 저장된 항목을 찾지 못했습니다. 인스타그램에서 받은 ZIP이 맞는지 확인해 주세요.', 'bad');
        return;
      }
      state.parsed = parsed;
      const owner = $('owner');
      owner.innerHTML = '';
      parsed.participants.forEach((name) => owner.add(new Option(name, name, false, name === parsed.owner)));
      setStatus(el, '읽기 완료', 'ok');
      $('step-preview').hidden = false;
      refreshThreads(true);
      renderSaved();
      $('step-preview').scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) {
      setStatus(el, '파일을 읽지 못했습니다: ' + e.message, 'bad');
    }
  }

  const drop = $('drop');
  drop.addEventListener('click', () => $('zip-input').click());
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('zip-input').click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.classList.add('over'); });
  drop.addEventListener('dragleave', () => drop.classList.remove('over'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('over');
    const zips = [...e.dataTransfer.files].filter((f) => /\.zip$/i.test(f.name));
    if (zips.length) load(entriesFromZips(zips));
    else setStatus($('file-status'), 'ZIP 파일을 올려 주세요.', 'bad');
  });
  $('zip-input').addEventListener('change', (e) => {
    if (e.target.files.length) load(entriesFromZips([...e.target.files]));
  });
  $('pick-dir').addEventListener('click', () => $('dir-input').click());
  $('dir-input').addEventListener('change', (e) => {
    const files = [...e.target.files].map((f) => ({ path: f.webkitRelativePath || f.name, text: () => f.text() }));
    if (files.length) load(files);
  });

  // ---- 3. 미리보기 ----
  function visibleThreads() {
    const withRequests = $('use-requests').checked;
    const q = $('search').value.trim().toLowerCase();
    return state.threads.filter((t) =>
      (withRequests || t.folder === 'inbox') && (!q || t.title.toLowerCase().includes(q)));
  }
  const chosenThreads = () => state.threads.filter((t) =>
    state.selected.has(t.key) && ($('use-requests').checked || t.folder === 'inbox'));

  function refreshThreads(reset) {
    state.threads = IGParser.receivedThreads(state.parsed.threads, $('owner').value);
    if (reset) state.selected = new Set(state.threads.map((t) => t.key));
    renderThreads();
  }

  function renderThreads() {
    const ul = $('threads');
    ul.innerHTML = '';
    for (const t of visibleThreads()) {
      const li = document.createElement('li');
      const label = document.createElement('label');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = state.selected.has(t.key);
      cb.addEventListener('change', () => {
        cb.checked ? state.selected.add(t.key) : state.selected.delete(t.key);
        updateCounts();
      });
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = t.title + (t.folder === 'inbox' ? '' : ' · 요청');
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = t.messages.length + '개 · ' + fmtDate(t.lastTs);
      label.append(cb, name);
      li.append(label, meta);
      ul.append(li);
    }
    updateCounts();
  }

  function updateCounts() {
    const chosen = chosenThreads();
    const msgs = chosen.reduce((n, t) => n + t.messages.length, 0);
    $('dm-count').textContent = '대화 ' + chosen.length + '개 · 메시지 ' + msgs.toLocaleString() + '개';
    $('saved-count').textContent = state.parsed.saved.length.toLocaleString() + '개';
  }

  function renderSaved() {
    const ul = $('saved');
    ul.innerHTML = '';
    for (const p of state.parsed.saved.slice(0, 200)) {
      const li = document.createElement('li');
      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = (p.author ? '@' + p.author : p.url) + ' · ' + p.kind +
        (p.collections.length ? ' · ' + p.collections.join(', ') : '');
      const meta = document.createElement('span');
      meta.className = 'meta';
      meta.textContent = fmtDate(p.savedAt);
      li.append(name, meta);
      ul.append(li);
    }
  }

  $('owner').addEventListener('change', () => refreshThreads(true));
  $('use-requests').addEventListener('change', renderThreads);
  $('search').addEventListener('input', renderThreads);
  $('all').addEventListener('click', () => { visibleThreads().forEach((t) => state.selected.add(t.key)); renderThreads(); });
  $('none').addEventListener('click', () => { visibleThreads().forEach((t) => state.selected.delete(t.key)); renderThreads(); });

  // ---- 4. 노션으로 보내기 ----
  $('run').addEventListener('click', async () => {
    const runStatus = $('run-status');
    const threads = $('use-dm').checked ? chosenThreads() : [];
    const posts = $('use-saved').checked ? state.parsed.saved : [];
    if (!threads.length && !posts.length) return setStatus(runStatus, '정리할 항목을 선택해 주세요.', 'bad');

    setStatus(runStatus, '노션 연결 확인 중…');
    try {
      await connect();
    } catch (e) {
      setStatus(runStatus, e.message, 'bad');
      $('step-notion').scrollIntoView({ behavior: 'smooth' });
      return;
    }
    setStatus(runStatus, '');
    $('run').disabled = true;
    $('step-run').hidden = false;
    $('result').innerHTML = '';
    $('errors').innerHTML = '';
    $('step-run').scrollIntoView({ behavior: 'smooth', block: 'start' });

    const total = threads.length + posts.length;
    const progress = $('progress-text');
    const reporter = (offset, label) => (i, n, name, error) => {
      if (error) {
        const li = document.createElement('li');
        li.textContent = name + ': ' + error;
        $('errors').append(li);
        return;
      }
      $('bar-fill').style.width = Math.round(((offset + i) / total) * 100) + '%';
      setStatus(progress, label + ' ' + (i + 1) + '/' + n + ' · ' + name);
    };
    const summary = (label, db, s) => {
      const p = document.createElement('p');
      const a = document.createElement('a');
      a.href = db.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = label;
      p.append(a, ' — 새로 ' + s.created + '개, 갱신 ' + s.updated + '개, 변동 없음 ' + s.skipped + '개' +
        (s.failed ? ', 실패 ' + s.failed + '개' : ''));
      $('result').append(p);
    };

    try {
      if (threads.length) {
        setStatus(progress, 'DM 데이터베이스 준비 중…');
        const db = await NotionSync.ensureDmDatabase(state.parentId);
        summary('받은 DM 데이터베이스 열기', db, await NotionSync.syncThreads(db.id, threads, reporter(0, '받은 DM')));
      }
      if (posts.length) {
        setStatus(progress, '저장한 게시물 데이터베이스 준비 중…');
        const db = await NotionSync.ensureSavedDatabase(state.parentId);
        summary('저장한 게시물 데이터베이스 열기', db, await NotionSync.syncSaved(db.id, posts, reporter(threads.length, '저장한 게시물')));
      }
      $('bar-fill').style.width = '100%';
      setStatus(progress, '완료되었습니다.', 'ok');
    } catch (e) {
      setStatus(progress, '중단되었습니다: ' + e.message, 'bad');
    } finally {
      $('run').disabled = false;
    }
  });
})();
