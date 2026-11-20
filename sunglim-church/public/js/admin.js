// 관리자 페이지: 주보 입력, 대표기도·봉사 명단(1년치), 교회 정보, 상단 메뉴
(function () {
  const { el, D, calliSrc } = window.App;
  const $ = (id) => document.getElementById(id);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  let settings = null;   // 교회 정보·메뉴
  let roster = [];       // 명단 전체
  let birthdayList = []; // 생일 명단(1년치)
  let events = [];       // 교회 일정(달력)
  let list = [];         // 주보 목록
  let cur = null;        // 지금 편집 중인 주보
  let curIsNew = false;
  let dirty = false;

  // ---------- 알림 ----------
  let toastTimer = null;
  function toast(msg, isErr) {
    const t = $('toast');
    t.textContent = msg; t.className = 'a-toast' + (isErr ? ' err' : ''); t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, isErr ? 6000 : 2600);
  }
  function errMsg(e) {
    if (e && (e.status === 401 || e.status === 403)) return '로그인이 만료되었거나 권한이 없습니다. 새로고침 후 다시 로그인해 주세요.';
    return '저장하지 못했습니다. 인터넷 연결을 확인해 주세요. (' + ((e && e.message) || e) + ')';
  }

  // ---------- 입력칸 도우미 ----------
  function bind(node, obj, key, onChange) {
    node.addEventListener('input', () => {
      obj[key] = node.type === 'checkbox' ? node.checked : node.value;
      if (onChange) onChange();
    });
    return node;
  }
  function text(obj, key, onChange, props) {
    return bind(el('input', Object.assign({ type: 'text', value: obj[key] == null ? '' : obj[key] }, props || {})), obj, key, onChange);
  }
  function area(obj, key, onChange, props) {
    const v = obj[key] || '';
    return bind(el('textarea', Object.assign({ rows: Math.min(14, Math.max(3, v.split('\n').length + 1)), value: v }, props || {})), obj, key, onChange);
  }
  function field(label, control, hint) {
    return el('label', { class: 'f' }, el('span', { class: 'f-l' }, label), control, hint ? el('small', null, hint) : null);
  }
  function card(title, hint) {
    const kids = Array.prototype.slice.call(arguments, 2);
    return el('div', { class: 'card' }, el('h2', null, title), hint ? el('p', { class: 'hint' }, hint) : null, kids);
  }
  function iconBtn(ch, label, disabled, fn, cls) {
    return el('button', { type: 'button', class: 'icon-btn ' + (cls || ''), 'aria-label': label, title: label, disabled: disabled, onclick: fn }, ch);
  }

  // 순서 바꾸기·삭제·추가가 되는 목록
  function listEditor(arr, o) {
    const host = el('div');
    function move(i, d) { const t = arr[i]; arr[i] = arr[i + d]; arr[i + d] = t; o.onChange(); draw(); }
    function draw() {
      host.textContent = '';
      host.appendChild(el('div', { class: 'list' }, arr.map((item, i) => {
        const r = o.row(item);
        const tools = el('div', { class: 'li-tools' },
          iconBtn('↑', '위로', i === 0, () => move(i, -1)),
          iconBtn('↓', '아래로', i === arr.length - 1, () => move(i, 1)),
          iconBtn('✕', '삭제', false, () => {
            const filled = Object.keys(item).some((k) => typeof item[k] === 'string' && item[k].trim() && k !== 'auto');
            if (filled && !confirm('이 항목을 삭제할까요?')) return;
            arr.splice(i, 1); o.onChange(); draw();
          }, 'del'));
        return el('div', { class: 'li' }, el('div', { class: 'li-head' }, r.head, tools), r.body ? el('div', { class: 'li-body' }, r.body) : null);
      })));
      host.appendChild(el('button', { class: 'a-btn a-small add-row', type: 'button', onclick: () => { arr.push(o.blank()); o.onChange(); draw(); } }, '+ ' + o.addLabel));
    }
    draw();
    return host;
  }

  // ================= 주보 =================
  function normalize(b) {
    const c = b.content = b.content || {};
    c.sermon = Object.assign({ title: '', scripture: '', preacher: '' }, c.sermon || {});
    c.memory = Object.assign({ ref: '', text: '' }, c.memory || {});
    c.order = c.order || []; c.news = c.news || [];
    // 헌금 명단은 주보 내용과 따로 둠 (예전 방식으로 저장된 것은 옮겨 옴)
    b.offerings = Array.isArray(b.offerings) ? b.offerings : (c.offerings || []);
    delete c.offerings;
    if (c.dutyWeeks == null) c.dutyWeeks = 2;
    if (c.prevMemoryRef == null) c.prevMemoryRef = '';
    if (c.scheduleAuto == null) c.scheduleAuto = false; // 예전 주보는 직접 적은 일정 그대로
    if (!c.scheduleWeeks) c.scheduleWeeks = 6;
    if (c.birthdaysAuto == null) c.birthdaysAuto = false; // 예전 주보는 직접 적은 내용 그대로
    if (!c.birthdayWeeks) c.birthdayWeeks = 1;
    return b;
  }

  // "제26-47호" → 다음 호수. 해가 바뀌면 1호부터.
  function nextIssue(prevIssue, prevDate, date) {
    const m = (prevIssue || '').match(/^(.*?)(\d+)-(\d+)(.*)$/);
    if (!m) return prevIssue || '';
    const newYear = D.parse(date).getFullYear() !== D.parse(prevDate).getFullYear();
    return m[1] + (newYear ? D.parse(date).getFullYear() % 100 : m[2]) + '-' + (newYear ? 1 : +m[3] + 1) + m[4];
  }

  function leaveOk() {
    return !dirty || confirm('저장하지 않은 내용이 있습니다. 저장하지 않고 이동할까요?');
  }

  async function openBulletin(date) {
    const b = await Store.getBulletin(date);
    if (!b) return toast('주보를 찾지 못했습니다', true);
    cur = normalize(b); curIsNew = false; dirty = false;
    drawBulletinTab();
  }

  // 지난주 주보를 복사해서 새 주보를 시작 (바뀌는 부분만 비움)
  async function newBulletin() {
    if (!leaveOk()) return;
    const prev = list[0] ? await Store.getBulletin(list[0].date) : null;
    const base = normalize(clone(prev || window.SEED.bulletins[0]));
    const c = base.content;
    const date = prev ? D.add(prev.date, 7) : D.nextSunday();
    const prevMemory = prev && prev.content.memory ? prev.content.memory.ref : '';
    c.sermon.title = ''; c.sermon.scripture = '';
    c.cellText = ''; c.cellQuestions = '';
    c.memory = { ref: '', text: '' };
    base.offerings.forEach((o) => { o.names = ''; });
    c.order.forEach((it) => {
      if (it.auto === 'prayer' || it.auto === 'reading') it.sub = '';
      if (/암송/.test(it.title || '')) { it.auto = 'memory'; it.who = ''; } // 말씀암송 줄은 지난주 암송구절로 자동
    });
    c.prevMemoryRef = prevMemory || '';
    if (events.length) c.scheduleAuto = true;        // 달력에 일정이 있으면 주보의 ‘교회 일정’도 달력에서
    if (birthdayList.length) c.birthdaysAuto = true; // 생일 명단이 있으면 그 주 생일자를 자동으로
    cur = { date, issue: prev ? nextIssue(prev.issue, prev.date, date) : '', published: false, content: c, offerings: base.offerings };
    curIsNew = true; dirty = true;
    drawBulletinTab();
    window.scrollTo(0, 0);
    toast(prev ? '지난주 주보를 복사했습니다. 바뀐 부분만 고쳐 주세요.' : '새 주보를 시작합니다');
  }

  // 그 주 생일자를 명단에서 계산해 주보 내용에 넣음 (자동일 때만)
  function fillBirthdays() {
    if (!cur || !cur.content.birthdaysAuto || !/^\d{4}-\d{2}-\d{2}$/.test(cur.date || '')) return;
    cur.content.birthdays = Birthdays.toText(Birthdays.inRange(birthdayList, cur.date, 7 * cur.content.birthdayWeeks));
  }

  async function saveBulletin(publish) {
    if (!cur) return;
    fillBirthdays();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(cur.date || '')) return toast('주일 날짜를 선택해 주세요', true);
    if (curIsNew && list.some((x) => x.date === cur.date) && !confirm(D.dot(cur.date) + ' 주보가 이미 있습니다. 덮어쓸까요?')) return;
    const was = cur.published;
    if (publish != null) cur.published = publish;
    try {
      await Store.saveBulletin(cur);
      list = await Store.listBulletins();
    } catch (e) { cur.published = was; return toast(errMsg(e), true); }
    dirty = false; curIsNew = false;
    drawBulletinTab();
    toast(cur.published ? '저장했습니다. 주보 페이지에 공개되었습니다.' : '임시 저장했습니다. (아직 공개 전)');
  }

  async function deleteBulletin() {
    if (!cur || curIsNew) return;
    if (!confirm(D.dot(cur.date) + ' 주보를 삭제할까요? 되돌릴 수 없습니다.')) return;
    try { await Store.deleteBulletin(cur.date); list = await Store.listBulletins(); }
    catch (e) { return toast(errMsg(e), true); }
    cur = null; dirty = false;
    if (list[0]) await openBulletin(list[0].date); else drawBulletinTab();
    toast('삭제했습니다');
  }

  // 주보를 PDF로: 인쇄 창을 띄우고, 파일 이름이 되도록 제목을 잠깐 바꿈
  function printBulletin() {
    if (!cur) return;
    drawPreview();
    const old = document.title;
    document.title = settings.church.name + ' 주보 ' + cur.date;
    const back = () => { document.title = old; window.removeEventListener('afterprint', back); };
    window.addEventListener('afterprint', back);
    setTimeout(() => window.print(), 150);
  }

  // "12/13 김장", "8/1~8/3 수련회" 같은 한 줄 → 일정. 연도는 주보 날짜를 기준으로 가까운 쪽.
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  function eventFromLine(line, baseIso) {
    const m = line.trim().match(/^(\d{1,2})\s*\/\s*(\d{1,2})(?:\s*[~\-–]\s*(?:(\d{1,2})\s*\/\s*)?(\d{1,2}))?\s+(.+)$/);
    if (!m) return null;
    const base = D.parse(baseIso);
    const at = (mo, d) => {
      if (!(mo >= 1 && mo <= 12 && d >= 1 && d <= 31)) return '';
      let iso = D.iso(new Date(base.getFullYear(), mo - 1, d));
      if (iso < D.add(baseIso, -60)) iso = D.iso(new Date(base.getFullYear() + 1, mo - 1, d)); // 연말 주보의 1월 일정
      return iso;
    };
    const date = at(+m[1], +m[2]);
    if (!date) return null;
    const end = m[4] ? at(m[3] ? +m[3] : +m[1], +m[4]) : '';
    return { id: newId(), date, endDate: end > date ? end : '', title: m[5].trim(), time: '', series: '' };
  }

  // ---------- 목사님 원고로 채우기 ----------
  let importOpen = false;
  async function applyManuscript(text) {
    const r = Manuscript.parse(text);
    if (!r.title && !r.scripture && !r.has.news && !r.has.cell && !r.has.schedule) {
      return toast('원고에서 항목을 찾지 못했습니다. ‘본문_’, ‘제목_’, ‘[광고]’ 같은 표시가 있는지 확인해 주세요.', true);
    }
    // 원고 날짜가 지금 열린 주보와 다르면 그 날짜 주보로 옮겨서 넣음
    if (r.date && cur && r.date !== cur.date) {
      if (curIsNew) cur.date = r.date;
      else if (confirm('이 원고는 ' + D.kor(r.date) + ' 주일 것입니다.\n\n[확인] ' + D.kor(r.date) + ' 주보에 넣기 (없으면 새로 만듭니다)\n[취소] 지금 열려 있는 ' + D.kor(cur.date) + ' 주보에 넣기')) {
        if (list.some((x) => x.date === r.date)) { if (!leaveOk()) return; await openBulletin(r.date); }
        else { await newBulletin(); if (!curIsNew) return; cur.date = r.date; }
      }
    }
    const c = cur.content, done = [];
    if (r.title) { c.sermon.title = r.title; done.push('설교 제목'); }
    if (r.scripture) { c.sermon.scripture = r.scripture; done.push('본문'); }
    if (r.memoryRef || r.memoryText) { c.memory = { ref: r.memoryRef, text: r.memoryText }; done.push('암송말씀'); }
    // 개수는 매주 달라도 됨: 원고에 그 구역이 있으면 지난주 것을 지우고 원고 내용으로 통째로 바꿈
    const kept = [];
    if (r.has.news) { c.news = r.news; done.push('소식 ' + r.news.length + '건'); } else kept.push('소식');
    if (r.has.cell) {
      c.cellText = r.cell.join('\n'); c.cellQuestions = r.questions.join('\n');
      done.push('셀 나눔'); done.push('나눔 질문 ' + r.questions.length + '개');
    } else kept.push('셀 나눔');
    if (r.has.schedule) {
      // 원고의 일정은 달력(교회 일정)에 합침: 달력에 없는 것만 새로 추가
      const norm = (t) => t.replace(/\s+/g, '');
      const fresh = [];
      let unread = 0;
      r.schedule.forEach((line) => {
        const ev = eventFromLine(line, cur.date);
        if (!ev) { unread++; return; }
        if (!events.concat(fresh).some((e) => e.date === ev.date && norm(e.title) === norm(ev.title))) fresh.push(ev);
      });
      if (fresh.length) {
        try { await Store.saveEvents(events.concat(fresh)); events = await Store.getEvents(); drawEventTab(); }
        catch (e) { return toast(errMsg(e), true); }
      }
      c.scheduleAuto = true;
      done.push('교회 일정 ' + r.schedule.length + '건' + (fresh.length ? ' (달력에 새로 추가 ' + fresh.length + '건)' : ' (모두 달력에 이미 있음)') + (unread ? ' · 날짜를 못 읽은 ' + unread + '줄은 뺌' : ''));
    } else kept.push('교회 일정');
    importOpen = false; dirty = true;
    drawBulletinTab();
    toast('넣었습니다: ' + done.join(', ') + '.' + (kept.length ? ' 원고에 없어서 지난주 그대로 둔 항목: ' + kept.join(', ') + '.' : '') + ' 미리보기로 확인하고 저장해 주세요.');
  }

  function importCard() {
    const ta = el('textarea', { rows: 7, placeholder: '여기에 원고 전체를 붙여넣거나, 한글(HWP) 파일을 끌어다 놓으세요.', 'aria-label': '목사님 원고' });
    async function loadFile(f) {
      try {
        ta.value = /\.(txt|md)$/i.test(f.name) ? await f.text() : await Manuscript.readHwp(await f.arrayBuffer());
        toast('파일을 읽었습니다. ‘항목별로 넣기’를 눌러 주세요.');
      } catch (e) {
        toast(e && e.message === 'password' ? '암호가 걸린 파일은 읽을 수 없습니다.' : '이 파일은 읽지 못했습니다. 한글에서 전체 선택(Ctrl+A) 후 복사해서 붙여넣어 주세요.', true);
      }
    }
    const file = el('input', { type: 'file', accept: '.hwp,.txt', hidden: true, onchange: () => { if (file.files[0]) loadFile(file.files[0]); file.value = ''; } });
    ta.addEventListener('dragover', (ev) => { ev.preventDefault(); ta.classList.add('drag'); });
    ta.addEventListener('dragleave', () => ta.classList.remove('drag'));
    ta.addEventListener('drop', (ev) => {
      ta.classList.remove('drag');
      const f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0];
      if (f) { ev.preventDefault(); loadFile(f); }
    });
    return el('div', { class: 'card import-card' },
      el('h2', null, '목사님 원고로 채우기'),
      el('p', { class: 'hint' }, '원고를 통째로 넣으면 설교 제목·본문, 암송말씀, 소식(광고), 셀 나눔과 질문, 교회 일정이 알아서 제자리에 들어갑니다. 예배 순서·생일·헌금명단은 그대로 둡니다.'),
      ta,
      el('div', { class: 'import-btns' },
        el('button', { type: 'button', class: 'a-btn', onclick: () => file.click() }, '한글(HWP) 파일 선택'),
        el('button', { type: 'button', class: 'a-btn a-primary', onclick: () => { if (!ta.value.trim()) return toast('원고를 붙여넣거나 파일을 선택해 주세요', true); applyManuscript(ta.value); } }, '항목별로 넣기'),
        el('button', { type: 'button', class: 'a-btn', onclick: () => { importOpen = false; drawBulletinTab(); } }, '닫기'),
        file));
  }

  let previewTimer = null, previewHost = null, stateEl = null;
  function changed() {
    dirty = true;
    if (stateEl) { stateEl.textContent = '저장하지 않은 변경 내용이 있습니다'; stateEl.className = 'save-state dirty'; }
    clearTimeout(previewTimer);
    previewTimer = setTimeout(drawPreview, 250);
  }
  function drawPreview() {
    if (!previewHost || !cur) return;
    const box = previewHost.parentNode; const top = box.scrollTop;
    BulletinView.render(previewHost, cur, roster, settings, events);
    box.scrollTop = top;
  }

  // 그 주일 명단을 보여주는 상자
  function autoBox() {
    const r = BulletinView.rosterFor(roster, cur.date);
    const go = el('button', { type: 'button', class: 'a-link', onclick: () => showTab('roster') }, '명단 고치기');
    if (r.prayer1 || r.prayer2 || r.reader2) {
      return el('div', { class: 'auto-box' },
        el('b', null, D.kor(cur.date) + ' 담당자를 명단에서 자동으로 불러왔습니다'), el('br'),
        '1부 대표기도: ' + (r.prayer1 || '—'), el('br'),
        '2부 대표기도: ' + (r.prayer2 || '—'), el('br'),
        '2부 성경봉독: ' + (r.reader2 || '—'), el('br'), go);
    }
    return el('div', { class: 'auto-box warn' },
      el('b', null, D.kor(cur.date) + ' 명단이 아직 없습니다'), el('br'),
      '‘대표기도·봉사 명단’에 넣어 두면 주보에 자동으로 들어갑니다. ', go);
  }

  function orderRow(it) {
    const kinds = [['', '일반'], ['prayer', '대표기도 (명단에서 자동)'], ['reading', '말씀봉독 (본문·봉독자 자동)'], ['memory', '말씀암송 (지난주 암송구절 자동)'], ['sermon', '설교 (제목·설교자 자동)']];
    const kind = el('select', { 'aria-label': '종류', onchange: () => { it.auto = kind.value; changed(); drawForm(); } },
      kinds.map((k) => el('option', { value: k[0], selected: (it.auto || '') === k[0] }, k[1])));
    const subHint = it.auto === 'prayer' || it.auto === 'reading' ? '자동 입력 (직접 쓰려면 입력)' : it.auto === 'sermon' ? '아랫줄 (보통 비워 둠)' : '아랫줄 (예: 찬양 제목)';
    return {
      head: [
        el('label', { class: 'stand-toggle', title: '일어서서 드리는 순서' }, bind(el('input', { type: 'checkbox', checked: it.stand }), it, 'stand', changed), '※'),
        el('div', { class: 'order-fields' },
          text(it, 'title', changed, { placeholder: '순서 이름', 'aria-label': '순서 이름' }),
          text(it, 'who', changed, { placeholder: it.auto === 'sermon' ? '설교자 (자동)' : it.auto === 'memory' ? '지난주 구절 (자동)' : '담당 (예: 다같이)', 'aria-label': '담당' }))
      ],
      body: el('div', { class: 'order-sub' }, text(it, 'sub', changed, { placeholder: subHint, 'aria-label': '아랫줄 내용' }), kind)
    };
  }

  let formHost = null;
  function drawForm() {
    if (!formHost || !cur) return;
    const c = cur.content;
    formHost.textContent = '';
    const dateInput = el('input', { type: 'date', value: cur.date, readonly: !curIsNew, onchange: () => { cur.date = dateInput.value; changed(); drawForm(); } });
    const notSunday = /^\d{4}-/.test(cur.date) && D.parse(cur.date).getDay() !== 0;

    formHost.appendChild(card('기본 정보', null,
      el('div', { class: 'row2' },
        field('주일 날짜', dateInput, curIsNew ? (notSunday ? '선택한 날짜가 주일이 아닙니다.' : null) : '저장된 주보의 날짜는 바꿀 수 없습니다.'),
        field('호수', text(cur, 'issue', changed, { placeholder: '제26-47호' }))),
      autoBox()));

    formHost.appendChild(card('설교', '여기 적은 내용이 예배 순서와 홈 화면 ‘이번 주 말씀’에 함께 들어갑니다.',
      field('설교 제목', text(c.sermon, 'title', changed)),
      el('div', { class: 'row2' },
        field('본문', text(c.sermon, 'scripture', changed, { placeholder: '행 13:44-52' })),
        field('설교자', text(c.sermon, 'preacher', changed))),
      el('div', { class: 'row2' },
        field('인도', text(c, 'leader', changed)),
        field('예배 시간 (한 줄에 하나)', area(c, 'worshipTimes', changed, { rows: 2 })))));

    formHost.appendChild(card('예배 순서', '※ 에 체크하면 ‘일어서서’ 표시가 붙습니다. 대표기도·말씀봉독·설교 줄은 위 내용과 명단에서 자동으로 채워집니다.',
      listEditor(c.order, { row: orderRow, blank: () => ({ stand: false, title: '', who: '', sub: '', auto: '' }), addLabel: '순서 추가', onChange: changed })));

    formHost.appendChild(card('교회 소식', '제목과 내용을 적습니다. 줄바꿈은 그대로 보입니다.',
      listEditor(c.news, {
        row: (n) => ({ head: text(n, 'title', changed, { placeholder: '소식 제목', 'aria-label': '소식 제목' }), body: area(n, 'body', changed, { placeholder: '내용', 'aria-label': '내용' }) }),
        blank: () => ({ title: '', body: '' }), addLabel: '소식 추가', onChange: changed
      })));

    const sAuto = bind(el('input', { type: 'checkbox', checked: c.scheduleAuto }), c, 'scheduleAuto', () => { changed(); drawForm(); });
    const sWeeks = el('select', { 'aria-label': '일정 범위', onchange: () => { c.scheduleWeeks = +sWeeks.value; changed(); drawForm(); } },
      [4, 6, 8, 12].map((n) => el('option', { value: n, selected: +c.scheduleWeeks === n }, '앞으로 ' + n + '주')));
    const sLines = c.scheduleAuto ? BulletinView.scheduleLines(cur, events) : [];
    formHost.appendChild(card('교회 일정', '‘교회 일정’ 탭(달력)에 넣은 일정이 주보에도 자동으로 실립니다.',
      el('label', { class: 'check' }, sAuto, '달력(교회 일정)에서 자동으로 불러오기'),
      c.scheduleAuto
        ? [field('보여줄 범위', sWeeks),
           el('div', { class: 'auto-box' + (sLines.length ? '' : ' warn') },
             el('b', null, sLines.length ? '이번 주보에 실리는 일정' : '이 기간에 등록된 일정이 없습니다'),
             sLines.map((t) => [el('br'), t]), el('br'),
             el('button', { type: 'button', class: 'a-link', onclick: () => showTab('event') }, '교회 일정 고치기'))]
        : field('직접 적기 (한 줄에 하나, 예: 12/13 김장)', area(c, 'schedule', changed, { 'aria-label': '교회 일정' }))));

    formHost.appendChild(card('셀 나눔 • 개인 적용', null,
      field('나눔 글', area(c, 'cellText', changed)),
      field('나눔 질문 (한 줄에 하나, 번호는 자동)', area(c, 'cellQuestions', changed))));

    formHost.appendChild(card('이번주 암송말씀', null,
      el('div', { class: 'row2' },
        field('성경 구절', text(c.memory, 'ref', changed, { placeholder: '행13:52' })),
        field('말씀', text(c.memory, 'text', changed))),
      field('지난주 암송구절', text(c, 'prevMemoryRef', changed, { placeholder: '합3:18' }), '예배 순서 가운데 ‘말씀암송’ 줄에 들어갑니다. 새 주보를 만들면 지난주 암송말씀 구절이 자동으로 채워집니다.')));

    const weeks = el('select', { onchange: () => { c.dutyWeeks = +weeks.value; changed(); } },
      [0, 1, 2, 3, 4].map((n) => el('option', { value: n, selected: +c.dutyWeeks === n }, n === 0 ? '표시 안 함' : '다음 ' + n + '주')));
    formHost.appendChild(card('예배위원/담당', '다음 주일들의 대표기도·성경봉독·설거지 담당을 명단에서 자동으로 불러와 보여줍니다.',
      field('보여줄 범위', weeks)));

    fillBirthdays();
    const bAuto = bind(el('input', { type: 'checkbox', checked: c.birthdaysAuto }), c, 'birthdaysAuto', () => { changed(); drawForm(); });
    const bWeeks = el('select', { 'aria-label': '생일 범위', onchange: () => { c.birthdayWeeks = +bWeeks.value; changed(); drawForm(); } },
      [[1, '이번 주 (주일~토요일)'], [2, '2주'], [4, '4주']].map((o) => el('option', { value: o[0], selected: +c.birthdayWeeks === o[0] }, o[1])));
    formHost.appendChild(card('생일축하합니다', '‘생일 명단’에 1년치를 넣어 두면 그 주 생일자만 자동으로 나옵니다. 음력 생일은 해마다 양력으로 바꿔서 계산합니다.',
      el('label', { class: 'check' }, bAuto, '생일 명단에서 자동으로 불러오기'),
      c.birthdaysAuto
        ? [field('보여줄 범위', bWeeks),
           el('div', { class: 'auto-box' + (c.birthdays ? '' : ' warn') },
             el('b', null, c.birthdays ? '이번 주보에 실리는 생일' : (birthdayList.length ? '이 기간에는 생일인 분이 없습니다' : '생일 명단이 아직 비어 있습니다')),
             c.birthdays ? c.birthdays.split('\n').map((t) => [el('br'), t]) : null, el('br'),
             el('button', { type: 'button', class: 'a-link', onclick: () => showTab('birthday') }, '생일 명단 고치기'))]
        : field('직접 적기 (한 줄에 한 명, 예: 11/26 정윤범 청년)', area(c, 'birthdays', changed, { 'aria-label': '생일' }))));

    formHost.appendChild(card('헌금명단 (주님께 드린 예물)', '여기 적은 명단은 주보에 나오지 않고, 비밀번호를 넣어야 열리는 ‘헌금명단’ 메뉴에서만 보입니다. 헌금 종류별로 이름을 띄어쓰기로 구분해 적습니다.',
      listEditor(cur.offerings, {
        row: (o) => ({ head: text(o, 'category', changed, { placeholder: '헌금 종류 (예: 십일조)', 'aria-label': '헌금 종류' }), body: area(o, 'names', changed, { placeholder: '이름', 'aria-label': '이름', rows: 2 }) }),
        blank: () => ({ category: '', names: '' }), addLabel: '헌금 종류 추가', onChange: changed
      })));

    if (!curIsNew) formHost.appendChild(el('p', { style: 'text-align:right' }, el('button', { type: 'button', class: 'a-btn a-small a-danger', onclick: deleteBulletin }, '이 주보 삭제')));
    drawPreview();
  }

  function drawBulletinTab() {
    const host = $('tab-bulletin');
    host.textContent = '';
    const sel = el('select', { 'aria-label': '편집할 주보 선택', onchange: () => {
      if (!sel.value) return;
      if (!leaveOk()) { sel.value = curIsNew ? '' : cur.date; return; }
      openBulletin(sel.value);
    } });
    if (curIsNew) sel.appendChild(el('option', { value: '', selected: true }, '새 주보 (저장 전)'));
    list.forEach((x) => sel.appendChild(el('option', { value: x.date, selected: !curIsNew && cur && x.date === cur.date }, D.dot(x.date) + ' ' + (x.issue || '') + (x.published ? '' : ' · 작성 중'))));
    host.appendChild(el('div', { class: 'b-toolbar' }, list.length || curIsNew ? sel : null,
      cur ? el('button', { type: 'button', class: 'a-btn', onclick: () => { importOpen = !importOpen; drawBulletinTab(); } }, '목사님 원고 넣기') : null,
      cur ? el('button', { type: 'button', class: 'a-btn', title: '인쇄 창에서 대상을 ‘PDF로 저장’으로 고르세요', onclick: printBulletin }, 'PDF로 저장') : null,
      el('button', { type: 'button', class: 'a-btn a-dark', onclick: newBulletin }, '+ 새 주보 만들기')));
    if (cur) host.appendChild(el('p', { class: 'pdf-hint' }, '‘PDF로 저장’을 누르면 인쇄 창이 열립니다. 대상(프린터)을 ‘PDF로 저장’으로 고르면 지금 보이는 주보가 PDF 파일로 저장됩니다.'));

    if (!cur) {
      host.appendChild(el('p', { class: 'empty' }, '아직 주보가 없습니다. ‘새 주보 만들기’를 눌러 시작하세요.'));
      formHost = previewHost = stateEl = null;
      return;
    }

    if (importOpen) host.appendChild(importCard());

    formHost = el('div', { class: 'form-col' });
    previewHost = el('div');
    const grid = el('div', { class: 'edit-grid' }, formHost,
      el('div', { class: 'preview-col' },
        el('p', { class: 'preview-head' }, el('span', null, '미리보기'), el('span', null, '입력하면 바로 반영됩니다')),
        el('div', { class: 'preview-phone' }, previewHost)));
    host.appendChild(grid);

    stateEl = el('span', { class: 'save-state' + (dirty ? ' dirty' : '') }, dirty ? '저장하지 않은 변경 내용이 있습니다' : '모든 내용이 저장되었습니다');
    const pv = el('button', { type: 'button', class: 'a-btn only-mobile', onclick: () => {
      const on = grid.classList.toggle('previewing');
      pv.textContent = on ? '편집으로' : '미리보기';
      window.scrollTo(0, 0);
    } }, '미리보기');
    host.appendChild(el('div', { class: 'savebar' }, el('div', { class: 'savebar-in' },
      el('span', { class: 'pub-badge' + (cur.published ? ' on' : '') }, cur.published ? '공개 중' : '공개 전'),
      stateEl, pv,
      cur.published
        ? [el('button', { type: 'button', class: 'a-btn', onclick: () => { if (confirm('주보 페이지에서 내릴까요?')) saveBulletin(false); } }, '공개 취소'),
           el('button', { type: 'button', class: 'a-btn a-primary', onclick: () => saveBulletin(null) }, '저장')]
        : [el('button', { type: 'button', class: 'a-btn', onclick: () => saveBulletin(null) }, '임시 저장'),
           el('button', { type: 'button', class: 'a-btn a-primary', onclick: () => saveBulletin(true) }, '저장하고 공개')])));
    drawForm();
  }

  // ================= 대표기도·봉사 명단 =================
  const R_COLS = [['prayer1', '1부 대표기도'], ['prayer2', '2부 대표기도'], ['reader2', '2부 성경봉독'], ['dish', '설거지담당']];
  let rYear = null, rRows = [], rExtra = [], rDirty = false, pasteOpen = false;

  function rowsForYear(y) {
    const saved = {};
    roster.forEach((r) => { saved[r.date] = r; });
    const dates = {};
    D.sundaysOfYear(y).forEach((d) => { dates[d] = 1; });
    roster.forEach((r) => { if (r.date.slice(0, 4) === String(y)) dates[r.date] = 1; });
    return Object.keys(dates).sort().map((d) => Object.assign({ date: d, prayer1: '', prayer2: '', reader2: '', dish: '' }, saved[d] ? clone(saved[d]) : {}));
  }
  const rowFilled = (r) => R_COLS.some((c) => (r[c[0]] || '').trim());

  // 엑셀·한글 표에서 복사한 글자를 읽음: 날짜, 1부 기도, 2부 기도, 2부 봉독, 설거지 순서
  function parsePaste(txt, year) {
    const out = [];
    txt.split(/\r?\n/).forEach((line) => {
      if (!line.trim()) return;
      let cells = line.split('\t');
      if (cells.length < 2) cells = line.split(/\s*[,|]\s*|\s{2,}/);
      cells = cells.map((s) => s.trim());
      const d = cells[0];
      let m, date = null;
      if ((m = d.match(/(\d{4})\s*[.\-\/년]\s*(\d{1,2})\s*[.\-\/월]\s*(\d{1,2})/))) date = [+m[1], +m[2], +m[3]];
      else if ((m = d.match(/(\d{1,2})\s*월\s*(\d{1,2})/))) date = [year, +m[1], +m[2]];
      else if ((m = d.match(/^(\d{1,2})\s*[\/.\-]\s*(\d{1,2})/))) date = [year, +m[1], +m[2]];
      if (!date || date[1] < 1 || date[1] > 12 || date[2] < 1 || date[2] > 31) return; // 제목 줄 등은 건너뜀
      out.push({ date: D.iso(new Date(date[0], date[1] - 1, date[2])), prayer1: cells[1] || '', prayer2: cells[2] || '', reader2: cells[3] || '', dish: cells[4] || '' });
    });
    return out;
  }

  function drawRosterTab(scrollToWeek) {
    const host = $('tab-roster');
    host.textContent = '';
    const thisYear = new Date().getFullYear();
    if (rYear == null) { rYear = D.parse(D.nextSunday()).getFullYear(); rRows = rowsForYear(rYear); }
    const years = {};
    [thisYear - 1, thisYear, thisYear + 1, rYear].forEach((y) => { years[y] = 1; });
    roster.forEach((r) => { years[+r.date.slice(0, 4)] = 1; });
    const ySel = el('select', { 'aria-label': '연도', onchange: () => {
      if (rDirty && !confirm('저장하지 않은 명단 변경이 있습니다. 버리고 이동할까요?')) { ySel.value = rYear; return; }
      rYear = +ySel.value; rRows = rowsForYear(rYear); rExtra = []; rDirty = false; drawRosterTab();
    } }, Object.keys(years).sort().map((y) => el('option', { value: y, selected: +y === rYear }, y + '년')));

    const addDate = el('input', { type: 'date', 'aria-label': '추가할 날짜', style: 'width:auto' });
    const stateR = el('span', { class: 'save-state' + (rDirty ? ' dirty' : '') }, rDirty ? '저장하지 않은 변경 내용이 있습니다' : '');
    const markDirty = () => { rDirty = true; stateR.textContent = '저장하지 않은 변경 내용이 있습니다'; stateR.className = 'save-state dirty'; };

    const pasteArea = el('textarea', { rows: 6, placeholder: '11/29\t이현주 집사\t강종숙 권사\t추창영 안수집사\t4셀\n12/6\t최진철 목사\t윤혜수 집사\t고진철 장로\t3셀', 'aria-label': '붙여넣을 내용' });
    const pasteBox = el('div', { class: 'paste-box', hidden: !pasteOpen },
      el('p', null, '엑셀이나 구글 시트에서 표를 복사해 아래에 붙여넣으세요. 칸 순서는 ',
        el('code', null, '날짜 · 1부 대표기도 · 2부 대표기도 · 2부 성경봉독 · 설거지담당'),
        ' 입니다. 날짜는 11/29, 11월 29일, 2026-11-29 모두 됩니다. 뒤쪽 칸은 없어도 됩니다.'),
      pasteArea,
      el('p', { style: 'margin-top:8px' }, el('button', { type: 'button', class: 'a-btn a-dark', onclick: () => {
        const rows = parsePaste(pasteArea.value, rYear);
        if (!rows.length) return toast('날짜를 읽지 못했습니다. 첫 칸이 날짜인지 확인해 주세요.', true);
        let other = 0;
        rows.forEach((r) => {
          if (r.date.slice(0, 4) === String(rYear)) {
            const i = rRows.findIndex((x) => x.date === r.date);
            if (i >= 0) rRows[i] = r; else rRows.push(r);
          } else { rExtra = rExtra.filter((x) => x.date !== r.date).concat([r]); other++; }
        });
        rRows.sort((a, b) => (a.date < b.date ? -1 : 1));
        rDirty = true; pasteOpen = false;
        drawRosterTab();
        toast(rows.length + '주 명단을 불러왔습니다' + (other ? ' (다른 연도 ' + other + '주 포함)' : '') + '. ‘명단 저장’을 눌러 주세요.');
      } }, '표에 넣기')));

    host.appendChild(card('대표기도·봉사 명단 (1년치)', '여기에 한 번 넣어 두면 매주 주보의 대표기도, 2부 성경봉독, ‘예배위원/담당’ 안내에 자동으로 들어갑니다. 지우려면 칸을 비우고 저장하세요.',
      el('div', { class: 'roster-tools' }, ySel,
        el('button', { type: 'button', class: 'a-btn', onclick: () => { pasteOpen = !pasteOpen; pasteBox.hidden = !pasteOpen; if (pasteOpen) pasteArea.focus(); } }, '엑셀에서 붙여넣기'),
        addDate,
        el('button', { type: 'button', class: 'a-btn', onclick: () => {
          const d = addDate.value;
          if (!d) return toast('추가할 날짜를 먼저 고르세요', true);
          if (d.slice(0, 4) !== String(rYear)) return toast(rYear + '년 날짜만 추가할 수 있습니다. 연도를 먼저 바꾸세요.', true);
          if (rRows.some((r) => r.date === d)) return toast('이미 있는 날짜입니다');
          rRows.push({ date: d, prayer1: '', prayer2: '', reader2: '', dish: '' });
          rRows.sort((a, b) => (a.date < b.date ? -1 : 1));
          drawRosterTab();
        } }, '날짜 추가'),
        stateR,
        el('button', { type: 'button', class: 'a-btn a-primary', onclick: saveRoster }, '명단 저장')),
      pasteBox,
      el('div', { class: 'r-head' }, el('span', null, '날짜'), R_COLS.map((c) => el('span', null, c[1])), el('span')),
      el('div', { class: 'roster' }, rRows.map((r) => {
        const upcoming = r.date === D.nextSunday();
        const day = '일월화수목금토'[D.parse(r.date).getDay()];
        return el('div', { class: 'r-row' + (upcoming ? ' this-week' : ''), id: upcoming ? 'r-this-week' : null },
          el('div', { class: 'r-date' }, el('span', null, D.kor(r.date) + ' (' + day + ')', upcoming ? el('small', null, '이번 주') : null)),
          R_COLS.map((c) => el('label', null, el('span', null, c[1]), text(r, c[0], markDirty, { 'aria-label': D.kor(r.date) + ' ' + c[1] }))),
          el('span'));
      }))));
    host.appendChild(el('p', { style: 'text-align:right' }, el('button', { type: 'button', class: 'a-btn a-primary', onclick: saveRoster }, '명단 저장')));
    if (scrollToWeek) { const w = $('r-this-week'); if (w) w.scrollIntoView({ block: 'center' }); }
  }

  async function saveRoster() {
    const had = {};
    roster.forEach((r) => { had[r.date] = 1; });
    const all = rRows.concat(rExtra);
    const keep = all.filter(rowFilled);
    const gone = all.filter((r) => !rowFilled(r) && had[r.date]).map((r) => r.date);
    try {
      await Store.saveRoster(keep, gone);
      roster = await Store.getRoster();
    } catch (e) { return toast(errMsg(e), true); }
    rDirty = false; rExtra = []; rRows = rowsForYear(rYear);
    drawRosterTab();
    drawForm(); // 주보 편집 화면의 자동 내용도 새 명단으로
    toast('명단을 저장했습니다 (' + keep.length + '주)');
  }

  // ================= 교회 일정 (달력) =================
  const WEEKDAY = '일월화수목금토';
  const evDraft = { date: '', endDate: '', title: '', time: '', repeat: 1 };
  let evEditId = null, evShowPast = false, evBusy = false;

  // 일정은 바꿀 때마다 바로 저장 (달력과 주보에 곧바로 반영)
  async function saveEvents(next, message) {
    if (evBusy) return false;
    evBusy = true;
    try { await Store.saveEvents(next); events = await Store.getEvents(); }
    catch (e) { evBusy = false; toast(errMsg(e), true); return false; }
    evBusy = false;
    drawEventTab(); drawForm();
    toast(message);
    return true;
  }

  function drawEventTab() {
    const host = $('tab-event');
    host.textContent = '';
    const today = D.today();

    // --- 새 일정 넣기
    const repeat = el('select', { 'aria-label': '반복', onchange: () => { evDraft.repeat = +repeat.value; } },
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 20, 26, 52].map((n) => el('option', { value: n, selected: evDraft.repeat === n }, n === 1 ? '반복 없음' : '매주 반복 · ' + n + '주간')));
    const dateIn = bind(el('input', { type: 'date', value: evDraft.date }), evDraft, 'date');
    const endIn = bind(el('input', { type: 'date', value: evDraft.endDate }), evDraft, 'endDate');
    host.appendChild(card('일정 넣기', '여기에 넣은 일정은 ‘교회 일정’ 달력과 주보의 ‘교회 일정’에 함께 나옵니다. 매주 반복되는 일정은 몇 주간인지 고르면 날짜마다 한꺼번에 들어갑니다.',
      field('일정 이름', text(evDraft, 'title', null, { placeholder: '예: 김장, 성경개관 주일반' })),
      el('div', { class: 'row2' }, field('날짜', dateIn), field('시간 (선택)', text(evDraft, 'time', null, { placeholder: '예: 오후 2시' }))),
      el('div', { class: 'row2' }, field('끝나는 날 (여러 날일 때만)', endIn), field('반복', repeat)),
      el('p', { style: 'text-align:right' }, el('button', { type: 'button', class: 'a-btn a-primary', onclick: async () => {
        const title = evDraft.title.trim();
        if (!title) return toast('일정 이름을 적어 주세요', true);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(evDraft.date)) return toast('날짜를 골라 주세요', true);
        if (evDraft.endDate && evDraft.endDate < evDraft.date) return toast('끝나는 날이 시작 날짜보다 빠릅니다', true);
        const n = evDraft.repeat || 1, series = n > 1 ? newId() : '';
        const added = [];
        for (let i = 0; i < n; i++) {
          added.push({ id: newId() + i, date: D.add(evDraft.date, 7 * i), endDate: evDraft.endDate && evDraft.endDate > evDraft.date ? D.add(evDraft.endDate, 7 * i) : '', title, time: evDraft.time.trim(), series });
        }
        if (await saveEvents(events.concat(added), n > 1 ? title + ' — 매주 ' + n + '번 넣었습니다' : title + ' 일정을 넣었습니다')) {
          evDraft.title = ''; evDraft.time = ''; evDraft.endDate = ''; evDraft.repeat = 1; drawEventTab();
        }
      } }, '일정 넣기'))));

    // --- 들어 있는 일정
    const shown = events.filter((e) => evShowPast || (e.endDate || e.date) >= today);
    const pastCount = events.length - events.filter((e) => (e.endDate || e.date) >= today).length;
    const rows = [];
    let lastMonth = '';
    shown.forEach((e) => {
      const ym = e.date.slice(0, 7);
      if (ym !== lastMonth) { lastMonth = ym; rows.push(el('h3', { class: 'ev-month' }, +ym.slice(0, 4) + '년 ' + +ym.slice(5) + '월')); }
      const later = e.series ? events.filter((x) => x.series === e.series && x.date >= e.date) : [];
      if (evEditId === e.id) {
        const draft = { date: e.date, endDate: e.endDate, title: e.title, time: e.time, all: false };
        rows.push(el('div', { class: 'ev-row editing' },
          field('일정 이름', text(draft, 'title')),
          el('div', { class: 'row2' }, field('날짜', bind(el('input', { type: 'date', value: draft.date }), draft, 'date')), field('시간', text(draft, 'time'))),
          field('끝나는 날 (여러 날일 때만)', bind(el('input', { type: 'date', value: draft.endDate }), draft, 'endDate')),
          later.length > 1 ? el('label', { class: 'check' }, bind(el('input', { type: 'checkbox' }), draft, 'all'), '이 날짜 뒤의 반복 일정 ' + (later.length - 1) + '건에도 이름·시간 적용') : null,
          el('div', { class: 'ev-btns' },
            el('button', { type: 'button', class: 'a-btn a-small', onclick: () => { evEditId = null; drawEventTab(); } }, '취소'),
            el('button', { type: 'button', class: 'a-btn a-small a-primary', onclick: async () => {
              const title = draft.title.trim();
              if (!title) return toast('일정 이름을 적어 주세요', true);
              if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return toast('날짜를 골라 주세요', true);
              if (draft.endDate && draft.endDate < draft.date) return toast('끝나는 날이 시작 날짜보다 빠릅니다', true);
              const next = events.map((x) => {
                if (x.id === e.id) return Object.assign({}, x, { date: draft.date, endDate: draft.endDate > draft.date ? draft.endDate : '', title, time: draft.time.trim() });
                if (draft.all && x.series === e.series && x.date > e.date) return Object.assign({}, x, { title, time: draft.time.trim() });
                return x;
              });
              evEditId = null;
              await saveEvents(next, draft.all ? '이 날짜와 뒤의 반복 일정을 고쳤습니다' : '이 날짜 일정만 고쳤습니다');
            } }, '저장'))));
        return;
      }
      rows.push(el('div', { class: 'ev-row' + ((e.endDate || e.date) < today ? ' past' : '') },
        el('span', { class: 'ev-date' }, el('b', null, window.App.eventDay(e)), el('small', null, WEEKDAY[D.parse(e.date).getDay()] + '요일')),
        el('span', { class: 'ev-what' }, el('b', null, e.title), el('small', null, [e.time, e.series ? '매주 반복' : ''].filter(Boolean).join(' · '))),
        el('span', { class: 'ev-btns' },
          el('button', { type: 'button', class: 'a-btn a-small', onclick: () => { evEditId = e.id; drawEventTab(); } }, '수정'),
          el('button', { type: 'button', class: 'a-btn a-small a-danger', onclick: () => {
            if (confirm(window.App.eventDay(e) + ' ‘' + e.title + '’ 일정을 삭제할까요?' + (e.series ? '\n(이 날짜만 삭제됩니다. 다른 날짜의 반복 일정은 그대로 남습니다.)' : ''))) saveEvents(events.filter((x) => x.id !== e.id), '삭제했습니다');
          } }, e.series ? '이 날만 삭제' : '삭제'),
          later.length > 1 ? el('button', { type: 'button', class: 'a-btn a-small a-danger', onclick: () => {
            if (confirm('‘' + e.title + '’ — ' + window.App.eventDay(e) + ' 부터 뒤의 반복 일정 ' + later.length + '건을 모두 삭제할까요?')) saveEvents(events.filter((x) => !(x.series === e.series && x.date >= e.date)), '반복 일정 ' + later.length + '건을 삭제했습니다');
          } }, '이후 반복 모두 삭제') : null)));
    });
    host.appendChild(card('들어 있는 일정', '반복으로 넣은 일정도 날짜마다 따로 고치거나 지울 수 있습니다. 고치면 바로 저장됩니다.',
      rows.length ? el('div', { class: 'ev-list' }, rows) : el('p', { class: 'empty' }, events.length ? '앞으로의 일정이 없습니다.' : '아직 넣은 일정이 없습니다.'),
      pastCount ? el('p', { style: 'margin-top:12px' }, el('button', { type: 'button', class: 'a-link', onclick: () => { evShowPast = !evShowPast; drawEventTab(); } }, evShowPast ? '지난 일정 숨기기' : '지난 일정 ' + pastCount + '건 보기')) : null,
      el('p', { style: 'margin-top:12px' }, el('a', { class: 'a-link', href: 'calendar.html', target: '_blank', rel: 'noopener' }, '달력 화면 열어 보기'))));
  }

  // ================= 생일 명단 =================
  let bDirty = false, bPasteOpen = false;
  function drawBirthdayTab() {
    const host = $('tab-birthday');
    host.textContent = '';
    const year = new Date().getFullYear();
    const stateB = el('span', { class: 'save-state' + (bDirty ? ' dirty' : '') }, bDirty ? '저장하지 않은 변경 내용이 있습니다' : '');
    const mark = () => { bDirty = true; stateB.textContent = '저장하지 않은 변경 내용이 있습니다'; stateB.className = 'save-state dirty'; };
    const num = (p, key, max, label) => {
      const n = el('input', { type: 'text', inputmode: 'numeric', value: p[key] || '', 'aria-label': label, placeholder: label, maxlength: 2 });
      n.addEventListener('input', () => { const v = parseInt(n.value, 10); p[key] = v >= 1 && v <= max ? v : 0; mark(); });
      n.addEventListener('change', () => drawBirthdayTab()); // 양력 환산 표시를 새로 계산
      return n;
    };

    const pasteArea = el('textarea', { rows: 6, placeholder: '정윤범 청년\t11/26\n홍성경 사모\t10/28\t음력', 'aria-label': '붙여넣을 내용' });
    const pasteBox = el('div', { class: 'paste-box', hidden: !bPasteOpen },
      el('p', null, '엑셀이나 구글 시트에서 표를 복사해 붙여넣으세요. 칸 순서는 ', el('code', null, '이름 · 생일(월/일) · 음력이면 “음력”'),
        ' 입니다. 날짜는 11/26, 11월 26일, 1985-11-26 모두 됩니다.'),
      pasteArea,
      el('p', { style: 'margin-top:8px' }, el('button', { type: 'button', class: 'a-btn a-dark', onclick: () => {
        const rows = Birthdays.parsePaste(pasteArea.value);
        if (!rows.length) return toast('읽을 수 있는 줄이 없습니다. 이름과 날짜가 있는지 확인해 주세요.', true);
        rows.forEach((r) => {
          const i = birthdayList.findIndex((x) => x.name === r.name);
          if (i >= 0) birthdayList[i] = r; else birthdayList.push(r);
        });
        bDirty = true; bPasteOpen = false;
        drawBirthdayTab();
        toast(rows.length + '명을 불러왔습니다. ‘생일 명단 저장’을 눌러 주세요.');
      } }, '명단에 넣기')));

    const save = () => el('button', { type: 'button', class: 'a-btn a-primary', onclick: saveBirthdays }, '생일 명단 저장');
    host.appendChild(card('생일 명단 (1년치)', '한 번 넣어 두면 매주 주보에 그 주 생일자만 자동으로 나옵니다. 음력에 체크하면 해마다 양력 날짜로 바꿔서 계산합니다. 이 명단 전체는 관리자만 볼 수 있습니다.',
      el('div', { class: 'roster-tools' },
        el('button', { type: 'button', class: 'a-btn', onclick: () => { birthdayList.push({ name: '', month: 0, day: 0, lunar: false }); bDirty = true; drawBirthdayTab(); const rows = host.querySelectorAll('.bd-row'); rows[rows.length - 1].querySelector('input').focus(); } }, '+ 한 명 추가'),
        el('button', { type: 'button', class: 'a-btn', onclick: () => { bPasteOpen = !bPasteOpen; pasteBox.hidden = !bPasteOpen; if (bPasteOpen) pasteArea.focus(); } }, '엑셀에서 붙여넣기'),
        stateB, save()),
      Birthdays.lunarOk ? null : el('div', { class: 'auto-box warn' }, el('b', null, '이 브라우저에서는 음력 계산을 할 수 없습니다.'), ' 크롬이나 엣지에서 열어 주세요.'),
      pasteBox,
      birthdayList.length ? el('div', { class: 'roster' }, birthdayList.map((p, i) => {
        const solar = p.lunar && p.month && p.day ? Birthdays.solarDates(p, year) : [];
        return el('div', { class: 'bd-row' },
          text(p, 'name', mark, { placeholder: '이름 (예: 홍길동 집사)', 'aria-label': '이름' }),
          el('div', { class: 'bd-date' }, num(p, 'month', 12, '월'), el('span', null, '월'), num(p, 'day', 31, '일'), el('span', null, '일')),
          el('label', { class: 'check bd-lunar' }, bind(el('input', { type: 'checkbox', checked: p.lunar }), p, 'lunar', () => { mark(); drawBirthdayTab(); }), '음력'),
          el('span', { class: 'bd-solar' }, p.lunar ? (solar.length ? year + '년 양력 ' + solar.join(', ') : (p.month && p.day ? year + '년에는 해당 날짜 없음' : '')) : ''),
          iconBtn('✕', '삭제', false, () => { if (p.name && !confirm(p.name + ' 님을 명단에서 뺄까요?')) return; birthdayList.splice(i, 1); bDirty = true; drawBirthdayTab(); }, 'del'));
      })) : el('p', { class: 'empty' }, '아직 생일 명단이 없습니다. ‘엑셀에서 붙여넣기’로 한꺼번에 넣거나 ‘+ 한 명 추가’를 눌러 주세요.')));
    if (birthdayList.length > 8) host.appendChild(el('p', { style: 'text-align:right' }, save()));
  }

  async function saveBirthdays() {
    const clean = birthdayList.filter((p) => (p.name || '').trim() && p.month && p.day);
    const skipped = birthdayList.length - clean.length;
    try {
      await Store.saveBirthdays(clean);
      birthdayList = await Store.getBirthdays();
    } catch (e) { return toast(errMsg(e), true); }
    bDirty = false;
    drawBirthdayTab();
    drawForm(); // 주보 편집 화면의 생일도 새 명단으로
    toast('생일 명단을 저장했습니다 (' + clean.length + '명)' + (skipped ? ' · 이름이나 날짜가 빠진 ' + skipped + '줄은 뺐습니다' : ''));
  }

  // ================= 교회 정보 / 상단 메뉴 =================
  let sDirty = false;
  const sChanged = () => { sDirty = true; };
  async function saveSettings() {
    try { await Store.saveSettings(settings); } catch (e) { return toast(errMsg(e), true); }
    sDirty = false;
    drawPreview();
    toast('저장했습니다');
  }
  const saveRow = () => el('p', { style: 'text-align:right' }, el('button', { type: 'button', class: 'a-btn a-primary', onclick: saveSettings }, '저장'));

  // 올린 그림을 너무 크지 않게 줄여서(가로 최대 1200) 투명 배경을 유지한 PNG로 만듦
  function shrinkImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1200 / img.naturalWidth);
        const cv = el('canvas', { width: Math.round(img.naturalWidth * k), height: Math.round(img.naturalHeight * k) });
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? resolve(b) : reject(new Error('convert'))), 'image/png');
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('load')); };
      img.src = url;
    });
  }

  function calliCard() {
    const c = settings.church;
    const img = el('img', { src: calliSrc(settings), alt: '현재 붓글씨 이미지' });
    const file = el('input', { type: 'file', accept: 'image/png,image/webp,image/jpeg', hidden: true, onchange: async () => {
      const f = file.files[0];
      if (!f) return;
      if (!/^image\/(png|webp|jpeg)$/.test(f.type)) return toast('PNG 이미지를 올려 주세요', true);
      pick.disabled = true; pick.textContent = '올리는 중…';
      try {
        const blob = await shrinkImage(f);
        c.calliUrl = await Store.uploadImage(blob, 'calli-' + Date.now() + '.png');
        await Store.saveSettings(settings);
        img.src = calliSrc(settings); drawPreview();
        toast('붓글씨 이미지를 바꿨습니다');
      } catch (e) { toast('이미지를 올리지 못했습니다. 다시 시도해 주세요.', true); }
      pick.disabled = false; pick.textContent = '이미지 바꾸기'; file.value = '';
    } });
    const pick = el('button', { type: 'button', class: 'a-btn a-dark', onclick: () => file.click() }, '이미지 바꾸기');
    const reset = el('button', { type: 'button', class: 'a-btn', onclick: async () => {
      if (!c.calliUrl || !confirm('기본 붓글씨 이미지로 되돌릴까요?')) return;
      c.calliUrl = '';
      try { await Store.saveSettings(settings); } catch (e) { return toast(errMsg(e), true); }
      img.src = calliSrc(settings); drawPreview();
      toast('기본 이미지로 되돌렸습니다');
    } }, '기본 이미지로');
    return card('표어 붓글씨 이미지', '홈 화면 첫머리에 들어가는 흰색 붓글씨입니다. 배경이 투명한 흰색 글씨 PNG를 올려 주세요. (가로로 긴 이미지 권장, 올리면 바로 반영됩니다)',
      el('div', { class: 'calli-preview' }, img),
      el('div', { class: 'calli-btns' }, pick, reset, file),
      field('표어 글자', text(c, 'vision', sChanged), '이미지를 볼 수 없는 분(화면 낭독기, 검색)에게 대신 읽히는 글자입니다. 이미지와 같은 문구로 적어 주세요.'));
  }

  function drawInfoTab() {
    const host = $('tab-info');
    const c = settings.church;
    host.textContent = '';
    host.appendChild(card('교회 기본 정보', '홈 화면, 주보 표지, 맨 아래 안내에 쓰입니다.',
      el('div', { class: 'row2' }, field('교회 이름', text(c, 'name', sChanged)), field('전화번호', text(c, 'phone', sChanged))),
      field('표어', text(c, 'slogan', sChanged)),
      field('주제 말씀 (홈·주보 맨 위)', area(c, 'verse', sChanged)),
      field('주소', text(c, 'address', sChanged), '지도와 ‘오시는 길’에 쓰입니다.'),
      el('div', { class: 'row2' }, field('담임목사', text(c, 'pastor', sChanged)), field('시무장로', text(c, 'elders', sChanged))),
      field('온라인 헌금 계좌', text(c, 'account', sChanged))));
    host.appendChild(calliCard());

    host.appendChild(card('예배 시간', '홈 화면과 맨 아래 안내에 보입니다.',
      listEditor(settings.services, {
        row: (s) => ({ head: text(s, 'name', sChanged, { placeholder: '예배 이름', 'aria-label': '예배 이름' }),
          body: el('div', { class: 'row2' }, text(s, 'time', sChanged, { placeholder: '시간 (예: 주일 오전 11시)', 'aria-label': '시간' }), text(s, 'place', sChanged, { placeholder: '장소', 'aria-label': '장소' })) }),
        blank: () => ({ name: '', time: '', place: '' }), addLabel: '예배 추가', onChange: sChanged
      })));

    host.appendChild(card('유튜브 · 인스타그램 · 블로그', '홈 화면에 최신 영상과 최근 사진이 자동으로 뜹니다.',
      field('유튜브 채널 주소', text(settings.youtube, 'channelUrl', sChanged, { placeholder: 'https://www.youtube.com/@…' })),
      field('유튜브 채널 ID', text(settings.youtube, 'channelId', sChanged, { placeholder: 'UC로 시작하는 24글자' }), '채널을 바꿀 때만 고칩니다. 유튜브 스튜디오 → 설정 → 채널 → 고급 설정에서 확인할 수 있습니다.'),
      field('인스타그램 아이디', text(settings.instagram, 'username', sChanged, { placeholder: '예: sunglim_church (@ 없이)', autocapitalize: 'none' }), '공개 계정이어야 홈 화면에 최근 사진이 보입니다. 비워 두면 인스타그램 구역이 숨겨집니다.'),
      field('블로그 주소', text(settings, 'blogUrl', sChanged))));
    host.appendChild(saveRow());
  }

  function drawMenuTab() {
    const host = $('tab-menu');
    host.textContent = '';
    settings.menu = settings.menu || [];
    host.appendChild(card('상단 메뉴', '‘홈’과 ‘주보’는 항상 맨 앞에 있습니다. 그 뒤에 붙일 메뉴를 이름과 링크 주소로 추가하세요. 외부 사이트는 새 창으로 열립니다.',
      listEditor(settings.menu, {
        row: (m) => ({ head: text(m, 'label', sChanged, { placeholder: '메뉴 이름 (예: 새가족 안내)', 'aria-label': '메뉴 이름' }),
          body: text(m, 'url', sChanged, { placeholder: 'https://…', 'aria-label': '링크 주소', inputmode: 'url', autocapitalize: 'none' }) }),
        blank: () => ({ label: '', url: '' }), addLabel: '메뉴 추가', onChange: sChanged
      })));
    host.appendChild(saveRow());
  }

  // ================= 탭 / 시작 =================
  function showTab(name) {
    document.querySelectorAll('.a-tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === name ? 'true' : 'false'));
    ['bulletin', 'roster', 'event', 'birthday', 'info', 'menu'].forEach((t) => { $('tab-' + t).hidden = t !== name; });
    if (name === 'roster') drawRosterTab(true);
    window.scrollTo(0, 0);
  }

  async function start() {
    $('login').hidden = true;
    $('app').hidden = false;
    try {
      settings = await Store.getSettings();
      roster = await Store.getRoster();
      birthdayList = await Store.getBirthdays();
      events = await Store.getEvents();
      list = await Store.listBulletins();
      if (Store.live && !list.length && !roster.length) {
        // 처음 설치한 직후: 캔바에 있던 주보와 명단을 기본 내용으로 넣어 둠
        await Store.saveRoster(window.SEED.roster, []);
        for (const b of window.SEED.bulletins) await Store.saveBulletin(b);
        roster = await Store.getRoster();
        list = await Store.listBulletins();
      }
      if (list[0]) cur = normalize(await Store.getBulletin(list[0].date));
    } catch (e) {
      $('tab-bulletin').appendChild(el('p', { class: 'empty' }, '내용을 불러오지 못했습니다. 인터넷 연결을 확인하고 새로고침해 주세요.'));
      return;
    }
    drawBulletinTab(); drawEventTab(); drawBirthdayTab(); drawInfoTab(); drawMenuTab();
    document.querySelectorAll('.a-tabs button').forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));
  }

  function showLogin() {
    $('login').hidden = false;
    $('login-form').addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const btn = $('login-btn'), err = $('login-err');
      btn.disabled = true; err.hidden = true;
      try {
        await Store.auth.signIn($('login-id').value.trim(), $('login-pw').value);
        $('logout').hidden = false;
        await start();
      } catch (e) {
        err.textContent = e && e.status === 429 ? '시도가 너무 많습니다. 1분 뒤에 다시 해 주세요.' : e && e.status === 401 ? '아이디 또는 비밀번호가 맞지 않습니다.' : ((e && e.message) || '로그인하지 못했습니다. 잠시 후 다시 해 주세요.'); err.hidden = false;
      }
      btn.disabled = false;
    });
    $('login-id').focus();
  }

  async function boot() {
    $('logout').addEventListener('click', () => { if (leaveOk()) { dirty = false; Store.auth.signOut(); location.reload(); } });
    $('demo-reset').addEventListener('click', () => { if (confirm('미리보기에서 바꾼 내용을 모두 지우고 처음 상태로 되돌릴까요?')) { dirty = false; Store.resetDemo(); location.reload(); } });
    window.addEventListener('beforeunload', (ev) => { if (dirty || rDirty || sDirty || bDirty) { ev.preventDefault(); ev.returnValue = ''; } });
    if (Store.live) {
      let ok = false;
      try { ok = await Store.auth.restore(); } catch (e) { ok = false; }
      if (!ok) return showLogin();
      $('logout').hidden = false;
    } else {
      $('demo-banner').hidden = false;
    }
    start();
  }
  boot();
})();
