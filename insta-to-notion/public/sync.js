// 노션에 데이터베이스를 만들고 받은 DM / 저장한 게시물을 기록한다.
(function (root) {
  const GAP_MS = 340; // 노션 제한(초당 약 3회)에 맞춘 호출 간격
  let token = '';
  let lastCall = 0;
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function setToken(t) { token = t.trim(); }

  async function call(method, path, body) {
    for (let attempt = 0; ; attempt++) {
      const wait = lastCall + GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      let res;
      try {
        res = await fetch('/api/notion', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-notion-token': token },
          body: JSON.stringify({ method, path, body }),
        });
      } catch (e) {
        if (attempt < 4) { await sleep(1500 * (attempt + 1)); continue; }
        throw new Error('서버에 연결하지 못했습니다.');
      }
      if ((res.status === 429 || res.status >= 500) && attempt < 4) {
        const retry = Number(res.headers.get('Retry-After')) || 2 * (attempt + 1);
        await sleep(retry * 1000);
        continue;
      }
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(json.message || '노션 요청 실패 (' + res.status + ')');
        err.status = res.status;
        err.code = json.code;
        throw err;
      }
      return json;
    }
  }

  function parsePageId(input) {
    // 주소 끝의 32자리가 ID다. 제목이 16진수 글자로 끝나도 섞이지 않게 끝에서부터 자른다.
    const clean = String(input || '').trim().split('?')[0].split('#')[0].replace(/\/+$/, '');
    const m = clean.replace(/-/g, '').match(/[0-9a-f]{32}$/i);
    return m ? m[0].toLowerCase() : '';
  }

  const text = (content, extra) => Object.assign({ type: 'text', text: { content } }, extra || {});
  const pad = (n) => String(n).padStart(2, '0');
  const dayLabel = (d) => d.getFullYear() + '년 ' + (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  const iso = (ts) => new Date(ts).toISOString();
  const optionName = (s) => s.replace(/,/g, ' ').slice(0, 100);

  function chunkText(s, limit) {
    const out = [];
    for (let i = 0; i < s.length && out.length < limit; i += 2000) out.push(s.slice(i, i + 2000));
    return out;
  }

  const DM_SCHEMA = {
    '대화': { title: {} },
    '보낸 사람': { rich_text: {} },
    '받은 메시지 수': { number: {} },
    '첫 메시지': { date: {} },
    '마지막 메시지': { date: {} },
    '구분': { select: { options: [{ name: '받은편지함', color: 'blue' }, { name: '메시지 요청', color: 'gray' }] } },
    '유형': { select: { options: [{ name: '1:1', color: 'green' }, { name: '그룹', color: 'purple' }] } },
    '스레드 ID': { rich_text: {} },
  };
  const SAVED_SCHEMA = {
    '이름': { title: {} },
    '작성자': { rich_text: {} },
    '링크': { url: {} },
    '저장일': { date: {} },
    '컬렉션': { multi_select: {} },
    '종류': { select: {} },
  };

  async function ensureDatabase(parentId, kind, title, icon, schema) {
    const storeKey = 'ig2notion:' + kind + ':' + parentId;
    const saved = localStorage.getItem(storeKey);
    if (saved) {
      try {
        const db = await call('GET', 'databases/' + saved);
        if (!db.archived && !db.in_trash) return db;
      } catch (e) {
        if (e.status !== 404 && e.status !== 400) throw e;
      }
    }
    // 다른 브라우저에서 이미 만든 데이터베이스가 있으면 그대로 이어 쓴다.
    let cursor = '';
    do {
      const r = await call('GET', 'blocks/' + parentId + '/children?page_size=100' + (cursor ? '&start_cursor=' + cursor : ''));
      const hit = r.results.find((b) => b.type === 'child_database' && !b.archived && b.child_database.title === title);
      if (hit) {
        localStorage.setItem(storeKey, hit.id);
        return call('GET', 'databases/' + hit.id);
      }
      cursor = r.has_more ? r.next_cursor : '';
    } while (cursor);

    const db = await call('POST', 'databases', {
      parent: { type: 'page_id', page_id: parentId },
      icon: { type: 'emoji', emoji: icon },
      title: [text(title)],
      properties: schema,
    });
    localStorage.setItem(storeKey, db.id);
    return db;
  }

  async function queryAll(dbId, onPage) {
    let cursor;
    do {
      const r = await call('POST', 'databases/' + dbId + '/query', cursor ? { start_cursor: cursor, page_size: 100 } : { page_size: 100 });
      r.results.forEach(onPage);
      cursor = r.has_more ? r.next_cursor : null;
    } while (cursor);
  }

  const plain = (prop) => ((prop && prop.rich_text) || []).map((t) => t.plain_text).join('');

  function threadBlocks(thread) {
    const blocks = [];
    let lastDay = '';
    for (const m of thread.messages) {
      const d = new Date(m.ts);
      const day = dayLabel(d);
      if (day !== lastDay) {
        blocks.push({ type: 'heading_3', heading_3: { rich_text: [text(day)] } });
        lastDay = day;
      }
      const head = pad(d.getHours()) + ':' + pad(d.getMinutes()) + (thread.isGroup ? ' ' + m.sender : '');
      const rich = [text(head + '  ', { annotations: { bold: true, color: 'gray' } })];
      chunkText(m.text, 20).forEach((c) => rich.push(text(c)));
      m.links.slice(0, 5).forEach((link) => {
        rich.push(text('\n'));
        rich.push({ type: 'text', text: { content: link.slice(0, 2000), link: { url: link } } });
      });
      blocks.push({ type: 'paragraph', paragraph: { rich_text: rich } });
    }
    return blocks;
  }

  async function syncThreads(dbId, threads, report) {
    const existing = new Map();
    await queryAll(dbId, (p) => {
      const key = plain(p.properties['스레드 ID']);
      if (key) existing.set(key, { id: p.id, count: p.properties['받은 메시지 수'].number });
    });
    const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };
    for (let i = 0; i < threads.length; i++) {
      const t = threads[i];
      report(i, threads.length, t.title);
      try {
        const prev = existing.get(t.key);
        if (prev && prev.count === t.messages.length) { stats.skipped++; continue; }
        if (prev) await call('PATCH', 'pages/' + prev.id, { archived: true });
        const senders = [...new Set(t.messages.map((m) => m.sender))].join(', ');
        const blocks = threadBlocks(t);
        const page = await call('POST', 'pages', {
          parent: { database_id: dbId },
          properties: {
            '대화': { title: [text(t.title.slice(0, 2000))] },
            '보낸 사람': { rich_text: [text(senders.slice(0, 2000))] },
            '받은 메시지 수': { number: t.messages.length },
            '첫 메시지': { date: { start: iso(t.firstTs) } },
            '마지막 메시지': { date: { start: iso(t.lastTs) } },
            '구분': { select: { name: t.folder === 'inbox' ? '받은편지함' : '메시지 요청' } },
            '유형': { select: { name: t.isGroup ? '그룹' : '1:1' } },
            '스레드 ID': { rich_text: [text(t.key.slice(0, 2000))] },
          },
          children: blocks.slice(0, 100),
        });
        for (let b = 100; b < blocks.length; b += 100) {
          report(i, threads.length, t.title + ' (' + Math.min(b, blocks.length) + '/' + blocks.length + ')');
          await call('PATCH', 'blocks/' + page.id + '/children', { children: blocks.slice(b, b + 100) });
        }
        prev ? stats.updated++ : stats.created++;
      } catch (e) {
        stats.failed++;
        report(i, threads.length, t.title, e.message);
      }
    }
    return stats;
  }

  async function syncSaved(dbId, posts, report) {
    const existing = new Set();
    await queryAll(dbId, (p) => {
      const url = p.properties['링크'] && p.properties['링크'].url;
      if (url) existing.add(url);
    });
    const stats = { created: 0, updated: 0, skipped: 0, failed: 0 };
    for (let i = 0; i < posts.length; i++) {
      const p = posts[i];
      const name = (p.author ? '@' + p.author + ' ' : '') + p.kind;
      report(i, posts.length, name);
      if (existing.has(p.url)) { stats.skipped++; continue; }
      try {
        const props = {
          '이름': { title: [text(name)] },
          '작성자': { rich_text: p.author ? [text(p.author)] : [] },
          '링크': { url: p.url },
          '종류': { select: { name: p.kind } },
          '컬렉션': { multi_select: p.collections.map((c) => ({ name: optionName(c) })) },
        };
        if (p.savedAt) props['저장일'] = { date: { start: iso(p.savedAt) } };
        await call('POST', 'pages', {
          parent: { database_id: dbId },
          properties: props,
          children: [
            { type: 'embed', embed: { url: p.url } },
            { type: 'paragraph', paragraph: { rich_text: [{ type: 'text', text: { content: '인스타그램에서 열기', link: { url: p.url } } }] } },
          ],
        });
        stats.created++;
      } catch (e) {
        stats.failed++;
        report(i, posts.length, name, e.message);
      }
    }
    return stats;
  }

  root.NotionSync = {
    setToken, call, parsePageId,
    ensureDmDatabase: (parentId) => ensureDatabase(parentId, 'dm', '인스타그램 받은 DM', '💬', DM_SCHEMA),
    ensureSavedDatabase: (parentId) => ensureDatabase(parentId, 'saved', '인스타그램 저장한 게시물', '🔖', SAVED_SCHEMA),
    syncThreads, syncSaved,
  };
})(self);
