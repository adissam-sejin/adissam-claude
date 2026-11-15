import {
  state, load, saveItem, deleteItem, saveLog, saveSettings, kvGet, kvSet, replaceAll, wearStats, itemById,
} from './store.js';
import {
  CATEGORIES, SEASONS, WARMTH, COLORS, catKo, colorOf, esc, uid, ymd, fromYmd, daysBetween, koDate, won,
  seasonOfMonth, glyph, tile, processPhoto, download,
} from './util.js';
import { DEFAULT_LOC, fetchWeather, searchCity, describe, contextFrom, recommend } from './stylist.js';
import { parsePurchases, guess } from './importer.js';
import { buildSample } from './sample.js';

const $ = (sel) => document.querySelector(sel);
const view = $('#view');
const tabbar = $('#tabbar');
const sheetRoot = $('#sheet-root');

const ui = {
  tab: 'today',
  month: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  filter: { cat: 'all', season: 'all', sort: 'recent' },
  sheets: [],
  weather: null,
  weatherState: 'idle', // idle | loading | ok | error
  recs: null,
};

const loc = () => state.settings.loc || DEFAULT_LOC;
const manualTemp = () => (typeof state.settings.manualTemp === 'number' ? state.settings.manualTemp : null);
const ctx = () => contextFrom(ui.weather, manualTemp());
const invalidate = () => { ui.recs = null; };

/* ───────────── 공통 UI ───────────── */

let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 2200);
}

const ICON = {
  today: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  closet: '<path d="M12 8.5c-1.4 0-2.3-1-2.3-2.2S10.7 4 12 4s2.3 1 2.3 2.2c0 1-.6 1.6-1.3 2-.6.4-1 .8-1 1.6v.7"/><path d="m12 10.5-8.2 5.6c-1.1.8-.6 2.4.7 2.4h15c1.3 0 1.8-1.6.7-2.4L12 10.5Z"/>',
  more: '<circle cx="5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="19" cy="12" r="1.3"/>',
};
const TABS = [['today', '오늘'], ['calendar', '캘린더'], ['closet', '옷장'], ['more', '더보기']];

function render() {
  view.innerHTML = VIEWS[ui.tab]();
  tabbar.innerHTML = TABS.map(([id, ko]) => `
    <button class="tab ${ui.tab === id ? 'on' : ''}" data-act="tab" data-v="${id}" ${ui.tab === id ? 'aria-current="page"' : ''}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${ICON[id]}</svg>
      <span>${ko}</span>
    </button>`).join('');
}

function renderSheet() {
  const top = ui.sheets[ui.sheets.length - 1];
  document.body.classList.toggle('sheet-open', !!top);
  if (!top) { sheetRoot.innerHTML = ''; return; }
  const prevScroll = sheetRoot.querySelector('.sheet-body')?.scrollTop || 0;
  const sameType = sheetRoot.firstElementChild?.dataset.type === top.type;
  sheetRoot.innerHTML = `
    <div class="backdrop ${sameType ? 'still' : ''}" data-type="${top.type}" data-act="closeSheet">
      <section class="sheet" role="dialog" aria-modal="true">
        <div class="sheet-grip"></div>
        ${SHEETS[top.type](top)}
      </section>
    </div>`;
  if (sameType) sheetRoot.querySelector('.sheet-body').scrollTop = prevScroll;
}

function openSheet(type, props = {}) { ui.sheets.push({ type, ...props }); renderSheet(); }
function closeSheet() { ui.sheets.pop(); renderSheet(); }
const topSheet = () => ui.sheets[ui.sheets.length - 1];
function refresh() { invalidate(); render(); renderSheet(); }

const sheetHead = (title, right = '') => `
  <header class="sheet-head">
    <button class="icon-btn" data-act="closeSheet" data-force="1" aria-label="닫기">✕</button>
    <h2>${title}</h2>
    <div class="sheet-head-right">${right}</div>
  </header>`;

function pickFile(input, cb) {
  input.value = '';
  input.onchange = () => { if (input.files[0]) cb(input.files[0]); };
  input.click();
}

/* ───────────── 날씨 ───────────── */

async function ensureWeather(force = false) {
  const l = loc();
  const key = `${l.lat},${l.lon}`;
  if (!force) {
    const cached = await kvGet('weather').catch(() => null);
    if (cached && cached.key === key && cached.data.date === ymd() && Date.now() - cached.data.ts < 30 * 60000) {
      ui.weather = cached.data; ui.weatherState = 'ok'; invalidate(); render(); return;
    }
  }
  ui.weatherState = 'loading';
  render();
  try {
    ui.weather = await fetchWeather(l);
    ui.weatherState = 'ok';
    kvSet('weather', { key, data: ui.weather }).catch(() => {});
  } catch {
    ui.weather = null;
    ui.weatherState = 'error';
  }
  invalidate();
  render();
}

/* ───────────── 화면: 오늘 ───────────── */

function weatherCard(c) {
  const mt = manualTemp();
  const w = ui.weather;
  let main;
  if (mt != null) {
    main = `<div class="wx-temp">${Math.round(mt)}<i>°</i></div>
      <div class="wx-meta"><strong>직접 설정한 기온</strong><span>이 기온을 기준으로 추천해요</span></div>`;
  } else if (w) {
    const d = describe(w.code);
    main = `<div class="wx-temp">${Math.round(w.temp)}<i>°</i></div>
      <div class="wx-meta">
        <strong>${d.icon} ${d.text}</strong>
        <span>최고 ${Math.round(w.tmax)}° · 최저 ${Math.round(w.tmin)}° · 체감 ${Math.round(w.feels)}°</span>
        <span>강수확률 ${w.pop ?? 0}%</span>
      </div>`;
  } else if (ui.weatherState === 'loading') {
    main = `<div class="wx-temp muted">··</div><div class="wx-meta"><strong>날씨를 불러오는 중…</strong></div>`;
  } else {
    main = `<div class="wx-temp muted">${Math.round(c.t)}<i>°</i></div>
      <div class="wx-meta"><strong>날씨를 불러오지 못했어요</strong><span>${c.season} 평균 기온으로 추천 중이에요</span>
      <span><button class="link" data-act="retryWeather">다시 시도</button> · <button class="link" data-act="openLocation">기온 직접 설정</button></span></div>`;
  }
  return `
    <section class="card wx">
      <div class="wx-top">
        <button class="pill" data-act="openLocation">📍 ${esc(loc().name)}</button>
        <span class="season-tag">${c.season}</span>
      </div>
      <div class="wx-main">${main}</div>
      <div class="wx-tip"><b>오늘의 옷차림</b> ${c.band.tip}</div>
      ${c.notes.map((n) => `<p class="wx-note">${n}</p>`).join('')}
    </section>`;
}

const lookTiles = (items) => `<div class="look-tiles">${items.map((it) => `
  <button class="look-item" data-act="openItem" data-id="${it.id}">${tile(it)}<span>${esc(it.name)}</span></button>`).join('')}</div>`;

function todayView() {
  const c = ctx();
  const today = ymd();
  const log = state.logs[today];
  const d = new Date();
  const head = `
    <header class="masthead">
      <div>
        <p class="eyebrow">${d.getFullYear()}. ${d.getMonth() + 1}. ${d.getDate()}</p>
        <h1><em>OOTD</em> 다이어리</h1>
      </div>
      <button class="btn ghost sm" data-act="openDay" data-date="${today}">${log ? '오늘 기록 보기' : '오늘 기록하기'}</button>
    </header>`;

  if (!state.items.length) {
    return `${head}${weatherCard(c)}
      <section class="card empty">
        <h2>옷장이 비어 있어요</h2>
        <p>가지고 있는 옷을 사진으로 등록하면, 날씨에 맞춰 스타일리스트가 코디를 골라 드려요.</p>
        <div class="stack">
          <button class="btn primary" data-act="newItem">옷 등록하기</button>
          <button class="btn" data-act="openImport">구매내역에서 가져오기</button>
          <button class="btn ghost" data-act="loadSample">샘플 옷장으로 둘러보기</button>
        </div>
      </section>`;
  }

  if (!ui.recs) ui.recs = recommend(state.items, wearStats(), c);
  const { looks, missing } = ui.recs;

  const todayBlock = log && log.itemIds.length ? `
    <section class="section">
      <div class="section-head"><h2>오늘 입은 옷</h2><button class="link" data-act="openDay" data-date="${today}">수정</button></div>
      <div class="card">${lookTiles(log.itemIds.map(itemById).filter(Boolean))}</div>
    </section>` : '';

  const recBlock = looks.length ? looks.map((look, i) => `
    <article class="card look">
      <div class="look-head"><span class="look-no">LOOK <em>${i + 1}</em></span></div>
      ${lookTiles(look.items)}
      <p class="look-comment">${esc(look.comment)}</p>
      <button class="btn primary block" data-act="wearLook" data-i="${i}">오늘 이 코디로 입기</button>
    </article>`).join('') : `
    <div class="card empty"><p>코디를 만들려면 <b>${missing.join(', ')}</b>가 필요해요. 옷장에 등록해 주세요.</p>
      <button class="btn primary" data-act="newItem">옷 등록하기</button></div>`;

  return `${head}${weatherCard(c)}${todayBlock}
    <section class="section">
      <div class="section-head">
        <h2>스타일리스트 추천</h2>
        ${looks.length ? '<button class="link" data-act="shuffle">↻ 다시 추천</button>' : ''}
      </div>
      <p class="section-sub">${Math.round(c.t)}°C 기준 · ${c.band.mood}</p>
      ${recBlock}
    </section>`;
}

/* ───────────── 화면: 캘린더 ───────────── */

function dayCellContent(log) {
  if (!log) return '';
  if (log.photo) return `<div class="cell-photo"><img src="${esc(log.photo)}" alt=""></div>`;
  const items = log.itemIds.map(itemById).filter(Boolean).slice(0, 4);
  if (!items.length) return log.note ? '<div class="cell-dot"></div>' : '';
  return `<div class="cell-grid n${items.length}">${items.map((it) => tile(it)).join('')}</div>`;
}

function calendarView() {
  const y = ui.month.getFullYear(), m = ui.month.getMonth();
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const today = ymd();
  const prefix = `${y}-${String(m + 1).padStart(2, '0')}-`;
  let cells = '';
  for (let i = 0; i < first; i++) cells += '<div class="cell blank"></div>';
  for (let d = 1; d <= days; d++) {
    const date = prefix + String(d).padStart(2, '0');
    const log = state.logs[date];
    cells += `<button class="cell ${date === today ? 'today' : ''} ${log ? 'has' : ''}" data-act="openDay" data-date="${date}" aria-label="${koDate(date)}">
      <span class="cell-no">${d}</span>${dayCellContent(log)}</button>`;
  }

  const monthLogs = Object.values(state.logs).filter((l) => l.date.startsWith(prefix));
  const counts = new Map();
  monthLogs.forEach((l) => l.itemIds.forEach((id) => counts.set(id, (counts.get(id) || 0) + 1)));
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([id, n]) => ({ it: itemById(id), n })).filter((x) => x.it);

  return `
    <header class="masthead">
      <div><p class="eyebrow">CALENDAR</p><h1><em>${y}</em>년 ${m + 1}월</h1></div>
      <div class="month-nav">
        <button class="icon-btn" data-act="month" data-v="-1" aria-label="이전 달">‹</button>
        <button class="btn ghost sm" data-act="month" data-v="0">오늘</button>
        <button class="icon-btn" data-act="month" data-v="1" aria-label="다음 달">›</button>
      </div>
    </header>
    <section class="card cal">
      <div class="weekdays">${['일', '월', '화', '수', '목', '금', '토'].map((w) => `<span>${w}</span>`).join('')}</div>
      <div class="grid">${cells}</div>
    </section>
    <section class="section">
      <div class="section-head"><h2>이달의 기록</h2></div>
      <div class="stats">
        <div class="stat"><b>${monthLogs.length}</b><span>기록한 날</span></div>
        <div class="stat"><b>${counts.size}</b><span>입은 옷 가짓수</span></div>
        <div class="stat"><b>${state.items.length ? Math.round((counts.size / state.items.length) * 100) : 0}%</b><span>옷장 활용률</span></div>
      </div>
      ${top.length ? `<div class="card"><p class="card-label">이달에 가장 많이 입은 옷</p><div class="look-tiles">${top.map(({ it, n }) => `
        <button class="look-item" data-act="openItem" data-id="${it.id}">${tile(it)}<span>${esc(it.name)}</span><small>${n}회</small></button>`).join('')}</div></div>`
      : '<p class="hint">날짜를 눌러 그날 입은 옷을 기록해 보세요.</p>'}
    </section>`;
}

/* ───────────── 화면: 옷장 ───────────── */

function closetView() {
  const f = ui.filter;
  const stats = wearStats();
  const nowSeason = seasonOfMonth(new Date().getMonth() + 1);
  let list = state.items.filter((i) => (f.cat === 'all' || i.category === f.cat)
    && (f.season === 'all' || (i.seasons || []).includes(f.season)));
  const cnt = (id) => (stats.get(id) || {}).count || 0;
  if (f.sort === 'recent') list.sort((a, b) => b.createdAt - a.createdAt);
  if (f.sort === 'most') list.sort((a, b) => cnt(b.id) - cnt(a.id));
  if (f.sort === 'least') list.sort((a, b) => cnt(a.id) - cnt(b.id));

  const chip = (group, v, label, extra = '') => `<button class="chip ${f[group] === v ? 'on' : ''}" data-act="filter" data-g="${group}" data-v="${v}">${label}${extra}</button>`;
  const catCount = (id) => state.items.filter((i) => i.category === id).length;

  return `
    <header class="masthead">
      <div><p class="eyebrow">MY CLOSET</p><h1>옷장 <em>${state.items.length}</em></h1></div>
      <div class="head-actions">
        <button class="btn ghost sm" data-act="openImport">구매내역</button>
        <button class="btn primary sm" data-act="newItem">＋ 등록</button>
      </div>
    </header>
    <div class="chips scroll">
      ${chip('cat', 'all', '전체')}
      ${CATEGORIES.map((c) => chip('cat', c.id, c.ko, catCount(c.id) ? `<i>${catCount(c.id)}</i>` : '')).join('')}
    </div>
    <div class="filter-row">
      <div class="chips">
        ${chip('season', 'all', '사계절')}
        ${SEASONS.map((s) => chip('season', s, s, s === nowSeason ? '<i class="now">지금</i>' : '')).join('')}
      </div>
      <select class="select" data-in="sort" aria-label="정렬">
        <option value="recent" ${f.sort === 'recent' ? 'selected' : ''}>최근 등록순</option>
        <option value="most" ${f.sort === 'most' ? 'selected' : ''}>많이 입은 순</option>
        <option value="least" ${f.sort === 'least' ? 'selected' : ''}>안 입은 순</option>
      </select>
    </div>
    ${list.length ? `<div class="closet-grid">${list.map((it) => `
      <button class="closet-item" data-act="openItem" data-id="${it.id}">
        ${tile(it)}
        <span class="ci-name">${esc(it.name)}</span>
        <span class="ci-meta">${cnt(it.id) ? `${cnt(it.id)}회 착용` : '아직 안 입음'}</span>
      </button>`).join('')}</div>` : `
      <div class="card empty">
        <p>${state.items.length ? '조건에 맞는 옷이 없어요.' : '아직 등록한 옷이 없어요.'}</p>
        <div class="stack">
          <button class="btn primary" data-act="newItem">옷 등록하기</button>
          ${state.items.length ? '' : '<button class="btn" data-act="openImport">구매내역에서 가져오기</button><button class="btn ghost" data-act="loadSample">샘플 옷장으로 둘러보기</button>'}
        </div>
      </div>`}`;
}

/* ───────────── 화면: 더보기 ───────────── */

function moreView() {
  const hasDemo = state.items.some((i) => i.demo);
  const logCount = Object.keys(state.logs).length;
  return `
    <header class="masthead"><div><p class="eyebrow">SETTINGS</p><h1>더보기</h1></div></header>
    ${state.persistent ? '' : '<p class="warn">이 브라우저에서는 저장소를 쓸 수 없어, 창을 닫으면 기록이 사라져요. (사생활 보호 모드를 꺼 주세요)</p>'}
    <section class="card list">
      <button class="row" data-act="openLocation"><span>날씨 위치 · 기온 설정</span><em>${esc(loc().name)}${manualTemp() != null ? ` · ${manualTemp()}° 고정` : ''}</em></button>
      <button class="row" data-act="openImport"><span>구매내역에서 옷 가져오기</span><em>›</em></button>
    </section>
    <section class="card list">
      <p class="card-label">백업</p>
      <button class="row" data-act="exportData"><span>백업 파일 내보내기</span><em>옷 ${state.items.length} · 기록 ${logCount}</em></button>
      <button class="row" data-act="importData"><span>백업 파일에서 복원</span><em>›</em></button>
      <p class="hint">옷 사진과 기록은 이 기기의 브라우저에만 저장돼요. 기기를 바꾸거나 브라우저 데이터를 지우기 전에 백업해 두세요.</p>
    </section>
    <section class="card list">
      ${hasDemo ? '<button class="row" data-act="clearSample"><span>샘플 옷 지우기</span><em>›</em></button>'
        : '<button class="row" data-act="loadSample"><span>샘플 옷장 불러오기</span><em>›</em></button>'}
      <button class="row danger" data-act="wipe"><span>모든 데이터 삭제</span><em>›</em></button>
    </section>`;
}

const VIEWS = { today: todayView, calendar: calendarView, closet: closetView, more: moreView };

/* ───────────── 시트: 아이템 등록/수정 ───────────── */

const blankDraft = () => ({
  name: '', category: 'top', seasons: [], warmth: 3, color: 'gray', brand: '', shop: '', price: '',
  boughtAt: '', memo: '', img: '', thumb: '', url: '', auto: true,
});

function itemFormSheet(s) {
  const d = s.draft;
  const chips = (f, opts, multi) => opts.map(([v, label]) => {
    const on = multi ? d[f].includes(v) : d[f] === v;
    return `<button type="button" class="chip ${on ? 'on' : ''}" data-act="draftChip" data-f="${f}" data-v="${v}" ${multi ? 'data-multi="1"' : ''}>${label}</button>`;
  }).join('');
  return `
    ${sheetHead(d.id ? '옷 수정' : '옷 등록', '<button class="btn primary sm" data-act="saveDraft">저장</button>')}
    <div class="sheet-body form">
      <button type="button" class="photo-drop ${d.img ? 'has' : ''}" data-act="draftPhoto">
        ${d.img ? `<img src="${esc(d.img)}" alt="">` : `${glyph(d.category, d.color)}<span>사진 올리기</span>`}
        ${d.img ? '<span class="photo-change">사진 바꾸기</span>' : ''}
      </button>
      <label class="field"><span>이름</span>
        <input type="text" data-f="name" value="${esc(d.name)}" placeholder="예: 그레이 울 코트" maxlength="80"></label>
      <div class="field"><span>카테고리</span><div class="chips">${chips('category', CATEGORIES.map((c) => [c.id, c.ko]))}</div></div>
      <div class="field"><span>계절 <small>여러 개 선택</small></span><div class="chips">${chips('seasons', SEASONS.map((x) => [x, x]), true)}</div></div>
      <div class="field"><span>두께 <small>날씨 추천에 쓰여요</small></span>
        <div class="chips">${WARMTH.map((w) => `<button type="button" class="chip ${d.warmth === w.v ? 'on' : ''}" data-act="draftChip" data-f="warmth" data-v="${w.v}" data-num="1">${w.ko}</button>`).join('')}</div>
        <small class="hint" data-hint="warmth">${WARMTH.find((w) => w.v === d.warmth).hint}에 입기 좋은 두께</small>
      </div>
      <div class="field"><span>색상</span>
        <div class="swatches">${COLORS.map((c) => `<button type="button" class="swatch ${c.id === 'multi' ? 'multi' : ''} ${d.color === c.id ? 'on' : ''}" style="--c:${c.hex}" data-act="draftChip" data-f="color" data-v="${c.id}" title="${c.ko}" aria-label="${c.ko}"></button>`).join('')}</div>
        <small class="hint" data-hint="color">${colorOf(d.color).ko}</small>
      </div>
      <div class="field-row">
        <label class="field"><span>브랜드</span><input type="text" data-f="brand" value="${esc(d.brand)}"></label>
        <label class="field"><span>구매처</span><input type="text" data-f="shop" value="${esc(d.shop)}" placeholder="무신사, 29CM…"></label>
      </div>
      <div class="field-row">
        <label class="field"><span>가격(원)</span><input type="number" inputmode="numeric" data-f="price" value="${esc(d.price ?? '')}"></label>
        <label class="field"><span>구매일</span><input type="date" data-f="boughtAt" value="${esc(d.boughtAt)}"></label>
      </div>
      <label class="field"><span>메모</span><textarea data-f="memo" rows="2" placeholder="사이즈, 세탁법, 어울리는 옷…">${esc(d.memo)}</textarea></label>
    </div>`;
}

/* ───────────── 시트: 아이템 상세 ───────────── */

function itemSheet(s) {
  const it = itemById(s.id);
  if (!it) return `${sheetHead('옷')}<div class="sheet-body"><p class="hint">삭제된 옷이에요.</p></div>`;
  const st = wearStats().get(it.id);
  const today = ymd();
  const wornToday = state.logs[today]?.itemIds.includes(it.id);
  const rows = [
    ['착용', st ? `${st.count}회 · 마지막 ${st.last === today ? '오늘' : `${daysBetween(st.last, today)}일 전`}` : '아직 안 입었어요'],
    it.price ? ['가격', won(it.price) + (st ? ` · 1회당 ${won(Math.round(it.price / st.count))}` : '')] : null,
    it.brand ? ['브랜드', esc(it.brand)] : null,
    it.shop || it.boughtAt ? ['구매', [esc(it.shop), it.boughtAt].filter(Boolean).join(' · ')] : null,
    it.memo ? ['메모', esc(it.memo)] : null,
  ].filter(Boolean);
  return `
    ${sheetHead(esc(catKo(it.category)), `<button class="btn ghost sm" data-act="editItem" data-id="${it.id}">수정</button>`)}
    <div class="sheet-body">
      <div class="detail-photo">${tile(it, { full: true })}</div>
      <h3 class="detail-name">${esc(it.name)}</h3>
      <div class="tags">
        <span class="tag"><i class="dot" style="background:${colorOf(it.color).hex}"></i>${colorOf(it.color).ko}</span>
        ${(it.seasons || []).map((x) => `<span class="tag">${x}</span>`).join('')}
        <span class="tag">${WARMTH.find((w) => w.v === (it.warmth || 3)).ko}</span>
      </div>
      <dl class="meta">${rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('')}</dl>
      ${it.url ? `<a class="link" href="${esc(it.url)}" target="_blank" rel="noopener noreferrer">상품 페이지 열기 ↗</a>` : ''}
      <div class="stack">
        <button class="btn primary block" data-act="toggleToday" data-id="${it.id}">${wornToday ? '오늘 기록에서 빼기' : '오늘 입었어요'}</button>
        <button class="btn danger-ghost block" data-act="removeItem" data-id="${it.id}">옷장에서 삭제</button>
      </div>
    </div>`;
}

/* ───────────── 시트: 날짜 기록 ───────────── */

const getLog = (date) => state.logs[date] || { date, itemIds: [], note: '', photo: '' };

function daySheet(s) {
  const log = getLog(s.date);
  const items = log.itemIds.map(itemById).filter(Boolean);
  const diff = daysBetween(ymd(), s.date);
  const w = log.weather;
  return `
    ${sheetHead(koDate(s.date), `<button class="btn primary sm" data-act="closeSheet" data-force="1">완료</button>`)}
    <div class="sheet-body">
      <p class="day-sub">${diff === 0 ? '오늘' : diff < 0 ? `${-diff}일 전` : `${diff}일 뒤 예정`}${w ? ` · ${describe(w.code).icon} ${Math.round(w.tmax)}° / ${Math.round(w.tmin)}°` : ''}</p>
      <div class="section-head"><h3>입은 옷</h3><button class="link" data-act="openPicker" data-date="${s.date}">${items.length ? '옷 바꾸기' : ''}</button></div>
      ${items.length ? `<div class="day-items">${items.map((it) => `
        <div class="day-item">
          <button data-act="openItem" data-id="${it.id}">${tile(it)}</button>
          <span>${esc(it.name)}</span>
          <button class="x" data-act="dayRemove" data-date="${s.date}" data-id="${it.id}" aria-label="빼기">✕</button>
        </div>`).join('')}
        <button class="day-add" data-act="openPicker" data-date="${s.date}">＋</button></div>`
      : `<button class="btn block" data-act="openPicker" data-date="${s.date}">옷장에서 고르기</button>`}
      <div class="section-head"><h3>착샷</h3></div>
      ${log.photo ? `<div class="day-photo"><img src="${esc(log.photo)}" alt="착용 사진">
          <div class="day-photo-actions"><button class="btn sm" data-act="dayPhoto" data-date="${s.date}">바꾸기</button><button class="btn sm" data-act="dayPhotoRemove" data-date="${s.date}">삭제</button></div></div>`
      : `<button class="btn block ghost" data-act="dayPhoto" data-date="${s.date}">전신 사진 올리기</button>`}
      <div class="section-head"><h3>메모</h3></div>
      <textarea class="note" data-note="${s.date}" rows="3" placeholder="오늘의 코디 한 줄 평, 갔던 곳, 기분…">${esc(log.note)}</textarea>
      ${state.logs[s.date] ? `<button class="btn danger-ghost block" data-act="dayClear" data-date="${s.date}">이 날 기록 지우기</button>` : ''}
    </div>`;
}

/* ───────────── 시트: 옷 고르기 ───────────── */

function pickerSheet(s) {
  const list = state.items.filter((i) => s.cat === 'all' || i.category === s.cat)
    .sort((a, b) => CATEGORIES.findIndex((c) => c.id === a.category) - CATEGORIES.findIndex((c) => c.id === b.category));
  return `
    ${sheetHead('입은 옷 고르기', `<button class="btn primary sm" data-act="pickerDone">${s.sel.length}개 선택</button>`)}
    <div class="sheet-body">
      <div class="chips scroll">
        <button class="chip ${s.cat === 'all' ? 'on' : ''}" data-act="pickerCat" data-v="all">전체</button>
        ${CATEGORIES.filter((c) => state.items.some((i) => i.category === c.id)).map((c) => `<button class="chip ${s.cat === c.id ? 'on' : ''}" data-act="pickerCat" data-v="${c.id}">${c.ko}</button>`).join('')}
      </div>
      ${list.length ? `<div class="closet-grid pick">${list.map((it) => `
        <button class="closet-item ${s.sel.includes(it.id) ? 'sel' : ''}" data-act="pickerToggle" data-id="${it.id}" aria-pressed="${s.sel.includes(it.id)}">
          ${tile(it)}<span class="ci-name">${esc(it.name)}</span><span class="check">✓</span>
        </button>`).join('')}</div>`
      : '<div class="card empty"><p>옷장에 등록된 옷이 없어요.</p><button class="btn primary" data-act="newItem">옷 등록하기</button></div>'}
    </div>`;
}

/* ───────────── 시트: 구매내역 가져오기 ───────────── */

function importSheet(s) {
  if (s.rows) {
    const n = s.rows.filter((r) => r.on).length;
    return `
      ${sheetHead('가져올 옷 확인', `<button class="btn primary sm" data-act="importCommit" ${n ? '' : 'disabled'}>${n}개 등록</button>`)}
      <div class="sheet-body">
        <p class="hint">상품명으로 카테고리·계절·두께·색상을 자동 분류했어요. 등록 후 옷장에서 사진을 추가하거나 수정할 수 있어요.</p>
        <div class="import-list">${s.rows.map((r, i) => `
          <div class="import-row ${r.on ? '' : 'off'}">
            <input type="checkbox" data-imp="${i}" ${r.on ? 'checked' : ''} aria-label="선택">
            ${tile(r)}
            <div class="ir-body">
              <strong>${esc(r.name)}</strong>
              <small>${[esc(r.brand), won(r.price), r.boughtAt, r.dup ? '이미 옷장에 있음' : ''].filter(Boolean).join(' · ')}</small>
              <select class="select" data-impcat="${i}" aria-label="카테고리">${CATEGORIES.map((c) => `<option value="${c.id}" ${r.category === c.id ? 'selected' : ''}>${c.ko}</option>`).join('')}</select>
            </div>
          </div>`).join('')}</div>
        <button class="btn ghost block" data-act="importBack">← 다시 입력</button>
      </div>`;
  }
  return `
    ${sheetHead('구매내역 가져오기', '<button class="btn primary sm" data-act="importParse">불러오기</button>')}
    <div class="sheet-body form">
      <p class="hint">쇼핑몰 주문내역이나 주문 확인 메일의 상품 목록을 붙여넣으세요. 한 줄에 상품 하나, 항목은 <b>|</b> 또는 탭으로 구분해요. 가격·날짜·이미지 주소는 순서와 상관없이 자동으로 알아봐요.</p>
      <label class="field"><span>구매처 <small>선택</small></span><input type="text" data-f="shop" value="${esc(s.shop || '')}" placeholder="무신사, 29CM, 쿠팡…"></label>
      <label class="field"><span>구매 목록</span>
        <textarea data-f="text" rows="8" placeholder="그레이 울 코트 | 브랜드명 | 189,000원 | 2026.10.03 | https://…/image.jpg&#10;블랙 터틀넥 니트 | 59,000원&#10;중청 데님 팬츠">${esc(s.text || '')}</textarea></label>
      <div class="stack">
        <button class="btn block" data-act="importFile">CSV · JSON 파일 선택</button>
        <button class="btn ghost block" data-act="importExample">예시 넣어보기</button>
      </div>
      <p class="hint">파일은 <code>name, brand, price, date, image, shop</code> (또는 상품명·브랜드·가격·구매일·이미지·구매처) 열을 인식해요.</p>
    </div>`;
}

/* ───────────── 시트: 위치/기온 ───────────── */

function locationSheet(s) {
  const mt = manualTemp();
  return `
    ${sheetHead('날씨 위치 · 기온')}
    <div class="sheet-body form">
      <div class="field"><span>도시 검색</span>
        <div class="search-row">
          <input type="search" data-f="q" value="${esc(s.q || '')}" placeholder="예: 서울, 부산, 제주" enterkeyhint="search">
          <button class="btn" data-act="citySearch">검색</button>
        </div>
      </div>
      ${s.msg ? `<p class="hint">${esc(s.msg)}</p>` : ''}
      ${(s.results || []).length ? `<div class="card list">${s.results.map((r, i) => `<button class="row" data-act="cityPick" data-i="${i}"><span>${esc(r.name)}</span><em>${esc(r.region)}</em></button>`).join('')}</div>` : ''}
      <button class="btn block" data-act="useGeo">📍 현재 위치 사용</button>
      <div class="field"><span>기온 직접 설정 <small>날씨 대신 이 기온으로 추천</small></span>
        <div class="temp-row">
          <input type="range" min="-15" max="38" step="1" value="${mt ?? Math.round(ctx().t)}" data-temp aria-label="기온">
          <output>${mt != null ? `${mt}°C` : '자동'}</output>
        </div>
        ${mt != null ? '<button class="link" data-act="tempAuto">자동(실제 날씨)으로 되돌리기</button>' : ''}
      </div>
    </div>`;
}

const SHEETS = {
  itemForm: itemFormSheet, item: itemSheet, day: daySheet, picker: pickerSheet, import: importSheet, location: locationSheet,
};

/* ───────────── 동작 ───────────── */

function mutateLog(date, fn) {
  const log = { ...getLog(date), itemIds: [...getLog(date).itemIds] };
  fn(log);
  if (date === ymd() && ui.weather && !log.weather) {
    log.weather = { code: ui.weather.dayCode, tmax: ui.weather.tmax, tmin: ui.weather.tmin };
  }
  saveLog(log);
  refresh();
}

function commitDraft(d) {
  const existing = d.id ? itemById(d.id) : null;
  const item = {
    ...(existing || { id: uid(), createdAt: Date.now() }),
    name: d.name.trim() || `${colorOf(d.color).ko} ${catKo(d.category)}`,
    category: d.category,
    seasons: SEASONS.filter((x) => d.seasons.includes(x)),
    warmth: d.warmth,
    color: d.color,
    brand: d.brand.trim(),
    shop: d.shop.trim(),
    price: d.price === '' || d.price == null ? null : Number(d.price),
    boughtAt: d.boughtAt,
    memo: d.memo.trim(),
    img: d.img,
    thumb: d.thumb,
    url: d.url || '',
  };
  delete item.demo;
  saveItem(item);
  return item;
}

const EXAMPLE = [
  '그레이 울 코트 | 스튜디오 샘플 | 189,000원 | 2026.10.03',
  '블랙 터틀넥 니트 | 59,000원 | 2026.10.03',
  '중청 데님 팬츠 | 79,000원 | 2026.09.12',
  '화이트 스니커즈 | 89,000원 | 2026.08.20',
].join('\n');

const ACTIONS = {
  tab(el) { ui.tab = el.dataset.v; render(); window.scrollTo(0, 0); },
  closeSheet(el, e) {
    if (!el.dataset.force && e.target !== el) return; // 배경을 직접 눌렀을 때만
    closeSheet();
    render();
  },
  month(el) {
    const v = Number(el.dataset.v);
    const now = new Date();
    ui.month = v === 0 ? new Date(now.getFullYear(), now.getMonth(), 1)
      : new Date(ui.month.getFullYear(), ui.month.getMonth() + v, 1);
    render();
  },
  filter(el) { ui.filter[el.dataset.g] = el.dataset.v; render(); },
  shuffle() { invalidate(); render(); },
  retryWeather() { ensureWeather(true); },

  // 아이템
  newItem() {
    const d = blankDraft();
    d.seasons = [seasonOfMonth(new Date().getMonth() + 1)];
    if (ui.filter.cat !== 'all' && ui.tab === 'closet') d.category = ui.filter.cat;
    openSheet('itemForm', { draft: d });
  },
  editItem(el) {
    const it = itemById(el.dataset.id);
    openSheet('itemForm', { draft: { ...blankDraft(), ...it, seasons: [...(it.seasons || [])], price: it.price ?? '', auto: false } });
  },
  openItem(el) { openSheet('item', { id: el.dataset.id }); },
  draftChip(el) {
    const d = topSheet().draft;
    const f = el.dataset.f;
    const v = el.dataset.num ? Number(el.dataset.v) : el.dataset.v;
    if (el.dataset.multi) d[f] = d[f].includes(v) ? d[f].filter((x) => x !== v) : [...d[f], v];
    else d[f] = v;
    d.auto = false;
    renderSheet();
  },
  draftPhoto() {
    pickFile($('#file-photo'), async (file) => {
      try {
        const p = await processPhoto(file);
        const d = topSheet().draft;
        d.img = p.img; d.thumb = p.thumb;
        if (p.color && d.auto) d.color = p.color;
        renderSheet();
      } catch { toast('사진을 읽지 못했어요. 다른 사진으로 시도해 주세요.'); }
    });
  },
  saveDraft() {
    const s = topSheet();
    const item = commitDraft(s.draft);
    ui.sheets.pop();
    // 수정 중이던 상세 시트가 아래에 있으면 그대로 갱신된다
    toast(s.draft.id ? '수정했어요' : `‘${item.name}’ 옷장에 등록했어요`);
    refresh();
  },
  removeItem(el) {
    const it = itemById(el.dataset.id);
    if (!confirm(`‘${it.name}’을(를) 옷장에서 삭제할까요?\n캘린더 기록에서도 빠져요.`)) return;
    deleteItem(it.id);
    ui.sheets.pop();
    toast('삭제했어요');
    refresh();
  },
  toggleToday(el) {
    const id = el.dataset.id;
    mutateLog(ymd(), (log) => {
      log.itemIds = log.itemIds.includes(id) ? log.itemIds.filter((x) => x !== id) : [...log.itemIds, id];
    });
    toast(state.logs[ymd()]?.itemIds.includes(id) ? '오늘 기록에 추가했어요' : '오늘 기록에서 뺐어요');
  },

  // 추천
  wearLook(el) {
    const look = ui.recs.looks[Number(el.dataset.i)];
    const ids = look.items.map((i) => i.id);
    const keep = ui.recs;
    mutateLog(ymd(), (log) => { log.itemIds = ids; });
    ui.recs = keep; // 방금 고른 추천 목록은 그대로 둔다
    render();
    toast('오늘의 OOTD로 기록했어요');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  },

  // 날짜 기록
  openDay(el) { openSheet('day', { date: el.dataset.date }); },
  openPicker(el) {
    openSheet('picker', { date: el.dataset.date, cat: 'all', sel: [...getLog(el.dataset.date).itemIds] });
  },
  pickerCat(el) { topSheet().cat = el.dataset.v; renderSheet(); },
  pickerToggle(el) {
    const s = topSheet();
    const id = el.dataset.id;
    s.sel = s.sel.includes(id) ? s.sel.filter((x) => x !== id) : [...s.sel, id];
    renderSheet();
  },
  pickerDone() {
    const s = ui.sheets.pop();
    mutateLog(s.date, (log) => { log.itemIds = s.sel; });
  },
  dayRemove(el) { mutateLog(el.dataset.date, (log) => { log.itemIds = log.itemIds.filter((x) => x !== el.dataset.id); }); },
  dayPhoto(el) {
    const date = el.dataset.date;
    pickFile($('#file-photo'), async (file) => {
      try {
        const p = await processPhoto(file, { max: 1000 });
        mutateLog(date, (log) => { log.photo = p.img; });
      } catch { toast('사진을 읽지 못했어요.'); }
    });
  },
  dayPhotoRemove(el) { mutateLog(el.dataset.date, (log) => { log.photo = ''; }); },
  dayClear(el) {
    if (!confirm('이 날의 기록을 모두 지울까요?')) return;
    saveLog({ date: el.dataset.date, itemIds: [], note: '', photo: '' });
    ui.sheets.pop();
    refresh();
  },

  // 구매내역
  openImport() { openSheet('import', { text: '', shop: '', rows: null }); },
  importExample() { topSheet().text = EXAMPLE; renderSheet(); },
  importFile() {
    pickFile($('#file-data'), async (file) => {
      topSheet().text = await file.text();
      ACTIONS.importParse();
    });
  },
  importParse() {
    const s = topSheet();
    const rows = parsePurchases(s.text, { shop: (s.shop || '').trim() });
    if (!rows.length) { toast('상품을 찾지 못했어요. 한 줄에 상품 하나씩 넣어 주세요.'); return; }
    const names = new Set(state.items.map((i) => i.name));
    s.rows = rows.map((r) => ({ ...r, dup: names.has(r.name), on: !names.has(r.name) }));
    renderSheet();
  },
  importBack() { topSheet().rows = null; renderSheet(); },
  importCommit() {
    const s = topSheet();
    const picked = s.rows.filter((r) => r.on);
    picked.forEach((r, i) => saveItem({
      id: uid() + i, createdAt: Date.now() + i,
      name: r.name, category: r.category, seasons: r.seasons, warmth: r.warmth, color: r.color,
      brand: r.brand, shop: r.shop, price: r.price, boughtAt: r.boughtAt, memo: '',
      img: r.img, thumb: r.img, url: r.url,
    }));
    ui.sheets.pop();
    ui.tab = 'closet';
    ui.filter = { cat: 'all', season: 'all', sort: 'recent' };
    toast(`${picked.length}개를 옷장에 등록했어요`);
    refresh();
  },

  // 위치
  openLocation() { openSheet('location', { q: '', results: [], msg: '' }); },
  async citySearch() {
    const s = topSheet();
    if (!(s.q || '').trim()) return;
    s.msg = '검색 중…'; renderSheet();
    try {
      s.results = await searchCity(s.q.trim());
      s.msg = s.results.length ? '' : '검색 결과가 없어요.';
    } catch { s.msg = '검색하지 못했어요. 네트워크를 확인해 주세요.'; }
    if (topSheet() === s) renderSheet();
  },
  cityPick(el) {
    const r = topSheet().results[Number(el.dataset.i)];
    saveSettings({ loc: { name: r.name, lat: r.lat, lon: r.lon } });
    closeSheet();
    ensureWeather(true);
  },
  useGeo() {
    if (!navigator.geolocation) { toast('이 브라우저는 위치를 지원하지 않아요.'); return; }
    navigator.geolocation.getCurrentPosition((pos) => {
      saveSettings({ loc: { name: '현재 위치', lat: +pos.coords.latitude.toFixed(3), lon: +pos.coords.longitude.toFixed(3) } });
      if (topSheet()?.type === 'location') closeSheet();
      ensureWeather(true);
    }, () => toast('위치 권한이 필요해요. 도시 검색을 이용해 주세요.'), { timeout: 8000 });
  },
  tempAuto() { saveSettings({ manualTemp: null }); refresh(); },

  // 데이터
  loadSample() {
    const { items, logs } = buildSample();
    items.forEach((i) => saveItem(i));
    logs.forEach((l) => { if (!state.logs[l.date]) saveLog(l); });
    toast('샘플 옷장을 불러왔어요');
    refresh();
  },
  clearSample() {
    if (!confirm('샘플 옷과 샘플 기록을 지울까요?')) return;
    state.items.filter((i) => i.demo).forEach((i) => deleteItem(i.id));
    Object.values(state.logs).filter((l) => l.demo && !l.itemIds.length).forEach((l) => saveLog({ ...l, note: '', photo: '' }));
    toast('샘플을 지웠어요');
    refresh();
  },
  exportData() {
    const data = { app: 'ootd-diary', version: 1, exportedAt: new Date().toISOString(), items: state.items, logs: state.logs, settings: state.settings };
    download(`ootd-diary-${ymd()}.json`, JSON.stringify(data));
    toast('백업 파일을 저장했어요');
  },
  importData() {
    pickFile($('#file-data'), async (file) => {
      try {
        const data = JSON.parse(await file.text());
        if (data.app !== 'ootd-diary' || !Array.isArray(data.items)) throw new Error('형식');
        if (!confirm(`백업(옷 ${data.items.length}개, 기록 ${Object.keys(data.logs || {}).length}일)으로 현재 데이터를 바꿀까요?`)) return;
        await replaceAll(data);
        toast('복원했어요');
        refresh();
        ensureWeather();
      } catch { toast('OOTD 다이어리 백업 파일이 아니에요.'); }
    });
  },
  async wipe() {
    if (!confirm('옷장과 모든 기록을 삭제할까요? 되돌릴 수 없어요.')) return;
    await replaceAll({ items: [], logs: {}, settings: {} });
    toast('모두 삭제했어요');
    refresh();
  },
};

/* ───────────── 이벤트 ───────────── */

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  const fn = ACTIONS[el.dataset.act];
  if (fn) fn(el, e);
});

document.addEventListener('input', (e) => {
  const t = e.target;
  const s = topSheet();
  if (t.dataset.f && s) {
    const target = s.draft || s;
    target[t.dataset.f] = t.value;
    if (t.dataset.f === 'name' && s.draft?.auto && t.value.trim()) {
      // 새 옷은 이름을 입력하면 카테고리·계절·두께를 자동으로 채운다.
      // 입력 중 포커스를 잃지 않도록 시트를 다시 그리지 않고 칩 상태만 바꾼다.
      const g = guess(t.value);
      Object.assign(s.draft, { category: g.category, seasons: g.seasons, warmth: g.warmth });
      if (!s.draft.img && g.color !== 'gray') s.draft.color = g.color;
      syncDraftChips(s.draft);
    }
  } else if (t.dataset.note) {
    const log = { ...getLog(t.dataset.note), note: t.value };
    saveLog(log);
  } else if (t.hasAttribute('data-temp')) {
    t.nextElementSibling.textContent = `${t.value}°C`;
  }
});

document.addEventListener('change', (e) => {
  const t = e.target;
  const s = topSheet();
  if (t.dataset.in === 'sort') { ui.filter.sort = t.value; render(); }
  else if (t.dataset.imp != null) { s.rows[Number(t.dataset.imp)].on = t.checked; renderSheet(); }
  else if (t.dataset.impcat != null) { s.rows[Number(t.dataset.impcat)].category = t.value; renderSheet(); }
  else if (t.hasAttribute('data-temp')) { saveSettings({ manualTemp: Number(t.value) }); refresh(); }
  else if (t.dataset.note) { render(); }
});

function syncDraftChips(d) {
  sheetRoot.querySelectorAll('[data-act="draftChip"]').forEach((b) => {
    const v = b.dataset.num ? Number(b.dataset.v) : b.dataset.v;
    const cur = d[b.dataset.f];
    b.classList.toggle('on', Array.isArray(cur) ? cur.includes(v) : cur === v);
  });
  const set = (sel, text) => { const el = sheetRoot.querySelector(sel); if (el) el.textContent = text; };
  set('[data-hint="warmth"]', `${WARMTH.find((w) => w.v === d.warmth).hint}에 입기 좋은 두께`);
  set('[data-hint="color"]', colorOf(d.color).ko);
  const drop = sheetRoot.querySelector('.photo-drop:not(.has) .glyph');
  if (drop) drop.outerHTML = glyph(d.category, d.color);
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && topSheet()) { closeSheet(); render(); }
  if (e.key === 'Enter' && e.target.dataset?.f === 'q') ACTIONS.citySearch();
});

// 외부 이미지가 깨지면 실루엣으로 대체
document.addEventListener('error', (e) => {
  const t = e.target;
  if (t.tagName === 'IMG' && t.dataset.cat) t.outerHTML = glyph(t.dataset.cat, t.dataset.color);
}, true);

/* ───────────── 시작 ───────────── */

(async function init() {
  await load();
  render();
  ensureWeather();
})();
