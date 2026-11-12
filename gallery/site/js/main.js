import { sb, rpc, imageUrl, fn, fnUpload } from './api.js';
import { ANIMALS, COLORS, AvatarPreview, avatarId, parseAvatar } from './avatars.js';
import { World } from './world.js';

const $ = (id) => document.getElementById(id);
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch { /* 저장 불가 환경 */ } },
};
const uuid = () => (crypto.randomUUID ? crypto.randomUUID()
  : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 3) | 8).toString(16);
  }));

// 하트 중복 방지용 기기 ID(유지)와 접속 세션 ID(탭마다 새로)
let visitorId = store.get('gallery.visitor');
if (!visitorId) {
  visitorId = uuid();
  store.set('gallery.visitor', visitorId);
}
const sessionId = uuid();

const saved = parseAvatar(store.get('gallery.avatar'));
const state = {
  code: '', name: '', animal: saved.animal, color: saved.color,
  target: null, // 현황판에서 고른 전시회
  mode: null, // 'lobby' | 'gallery'
  from: null, // 전시실에서 나갈 때 돌아갈 곳
  board: [], // 전시회 목록
  role: 'visitor', exhibition: null, student: null, artworks: [],
  channel: null, live: false, timers: [], viewing: null,
};
let world = null;

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

// ───────────── 전시회 현황판 ─────────────

const fmtDate = (d) => (d ? d.slice(0, 10).replace(/-/g, '.') : '');
function period(ex) {
  if (ex.starts_on && ex.ends_on) return `${fmtDate(ex.starts_on)} – ${fmtDate(ex.ends_on)}`;
  if (ex.starts_on) return `${fmtDate(ex.starts_on)} –`;
  if (ex.ends_on) return `– ${fmtDate(ex.ends_on)}`;
  return '상시 전시';
}
const STATE_LABEL = { active: '전시중', upcoming: '오픈 예정', ended: '종료' };

function posterCard(ex, index) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `poster ${ex.state} design-${index % 6}`;
  const art = document.createElement('div');
  art.className = 'poster-art';
  if (ex.poster) {
    const img = document.createElement('img');
    img.src = imageUrl(ex.poster);
    img.alt = '';
    img.loading = 'lazy';
    art.append(img);
  } else {
    const t = document.createElement('span');
    t.className = 'poster-title';
    t.textContent = ex.name;
    const k = document.createElement('span');
    k.className = 'poster-kicker';
    k.textContent = 'EXHIBITION';
    art.append(k, t);
  }
  const badge = document.createElement('span');
  badge.className = 'poster-badge';
  badge.textContent = STATE_LABEL[ex.state];
  art.append(badge);

  const info = document.createElement('div');
  info.className = 'poster-info';
  const name = document.createElement('strong');
  name.textContent = ex.name;
  const when = document.createElement('span');
  when.textContent = period(ex);
  const count = document.createElement('span');
  count.textContent = `작품 ${ex.artworks}점`;
  info.append(name, when, count);
  card.append(art, info);

  card.addEventListener('click', () => {
    if (ex.state === 'ended') return toast('종료된 전시회입니다.');
    if (ex.state === 'upcoming') return toast(`아직 열리지 않은 전시회입니다. ${ex.starts_on ? `${fmtDate(ex.starts_on)}에 열립니다.` : ''}`);
    openEntry(ex);
  });
  return card;
}

async function loadBoard() {
  const body = $('boardBody');
  let list;
  try {
    list = await rpc('list_exhibitions');
  } catch (err) {
    console.error(err);
    body.innerHTML = '<p class="board-empty">전시회 목록을 불러오지 못했습니다. 새로고침해 주세요.</p>';
    return;
  }
  state.board = list;
  body.replaceChildren();
  if (!list.length) {
    body.innerHTML = '<p class="board-empty">아직 등록된 전시회가 없습니다.</p>';
    return;
  }
  const groups = [
    ['active', '지금 전시중'],
    ['upcoming', '오픈 예정'],
    ['ended', '지난 전시'],
  ];
  let i = 0;
  for (const [key, title] of groups) {
    const items = list.filter((e) => e.state === key);
    if (!items.length) continue;
    const sec = document.createElement('section');
    const h = document.createElement('h2');
    h.textContent = title;
    const n = document.createElement('span');
    n.textContent = items.length;
    h.append(n);
    const grid = document.createElement('div');
    grid.className = 'poster-grid';
    for (const ex of items) grid.append(posterCard(ex, i++));
    sec.append(h, grid);
    body.append(sec);
  }
}

// ───────────── 입장 ─────────────

let preview = null;
function buildAvatarPicker() {
  try { preview = new AvatarPreview(200); } catch { preview = null; }
  for (const a of ANIMALS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.id = a.id;
    const img = document.createElement('img');
    img.alt = '';
    b.append(img, a.name);
    b.addEventListener('click', () => { state.animal = a.id; syncPicker(false); });
    $('avatars').append(b);
  }
  COLORS.forEach((c, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', c.name);
    b.title = c.name;
    b.style.background = `#${c.hex.toString(16).padStart(6, '0')}`;
    b.addEventListener('click', () => { state.color = i; syncPicker(true); });
    $('colors').append(b);
  });
  syncPicker(true);
}

function syncPicker(redraw) {
  for (const b of $('avatars').children) {
    b.setAttribute('aria-checked', String(b.dataset.id === state.animal));
    if (redraw && preview) b.querySelector('img').src = preview.render(avatarId(b.dataset.id, state.color));
  }
  [...$('colors').children].forEach((b, i) => b.setAttribute('aria-checked', String(i === state.color)));
}

function showEntryError(msg) {
  const el = $('entryError');
  el.textContent = msg;
  el.hidden = !msg;
}

function openEntry(ex, code = '') {
  state.target = ex;
  $('entryTitle').textContent = ex ? ex.name : '전시회 입장';
  $('code').value = code;
  // 이름을 아직 정하지 않았다면 여기서 받는다
  $('entryNameWrap').hidden = !!$('name').value.trim();
  showEntryError('');
  if (world) world.paused = true;
  $('entry').hidden = false;
  if (!matchMedia('(pointer: coarse)').matches) $('code').focus();
}

const myCodeKey = (exId) => `gallery.student.${exId}`;

function enterErrorText(data) {
  switch (data.error) {
    case 'not_found': return '코드를 찾을 수 없습니다. 입장 코드를 다시 확인해 주세요.';
    case 'ended': return `「${data.name}」 전시회는 종료되었습니다.`;
    case 'upcoming': return `「${data.name}」 전시회는 아직 열리지 않았습니다.${data.starts_on ? ` (${fmtDate(data.starts_on)} 오픈)` : ''}`;
    case 'full': return '수강생 등록 인원이 모두 찼습니다. 강사에게 문의해 주세요.';
    case 'name_taken': return '이미 등록된 이름입니다. 본인이라면 발급받은 개인 코드를 입력하고, 아니라면 다른 이름(예: 홍길동2)으로 입장해 주세요.';
    default: return '입장하지 못했습니다. 잠시 후 다시 시도해 주세요.';
  }
}

$('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  let code = $('code').value.replace(/\s/g, '').toUpperCase();
  if (!$('name').value.trim()) $('name').value = $('entryName').value.trim();
  const name = $('name').value.trim();
  if (!code) return;
  if (!name) return showEntryError('이름을 입력해 주세요.');
  showEntryError('');
  const btn = $('enterBtn');
  btn.disabled = true;
  btn.textContent = '입장 중…';
  try {
    let data = await rpc('enter', { p_code: code, p_visitor: visitorId, p_name: name });
    // 이 기기에서 같은 이름으로 이미 개인 코드를 받았다면 그 코드로 다시 입장
    if (data.error === 'name_taken') {
      let mine = null;
      try { mine = JSON.parse(store.get(myCodeKey(data.exhibition_id))); } catch { /* 없음 */ }
      if (mine && mine.name.toLowerCase() === name.toLowerCase()) {
        code = mine.code;
        data = await rpc('enter', { p_code: code, p_visitor: visitorId, p_name: name });
      }
    }
    if (data.error) return showEntryError(enterErrorText(data));
    if (state.target && data.exhibition.id !== state.target.id) {
      return showEntryError(`이 코드는 「${data.exhibition.name}」 전시회의 코드입니다. 현황판에서 해당 전시회를 선택해 주세요.`);
    }
    state.code = data.student?.code || code;
    state.name = name;
    store.set('gallery.name', name);
    store.set('gallery.avatar', avatarId(state.animal, state.color));
    if (data.student) {
      store.set(myCodeKey(data.exhibition.id), JSON.stringify({ code: data.student.code, name: data.student.name }));
    }
    data.theme = await rpc('exhibition_theme', { p_id: data.exhibition.id }).catch(() => 'white');
    state.from = state.mode === 'lobby' ? 'lobby' : null;
    teardown();
    enterGallery(data);
  } catch (err) {
    showEntryError('접속에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    console.error(err);
  } finally {
    btn.disabled = false;
    btn.textContent = '입장하기';
  }
});

// ───────────── 전시관 ─────────────

function applyData(data) {
  state.role = data.role;
  state.exhibition = data.exhibition;
  state.student = data.student;
  state.artworks = data.artworks;
  world.setArtworks(data.artworks, imageUrl);
  $('uploadBtn').hidden = data.role !== 'student';
}

function ensureWorld() {
  if (world) return true;
  try {
    world = new World({ canvas: $('scene'), joystick: $('joystick'), onPick });
    return true;
  } catch (err) {
    console.error(err);
    toast('이 기기에서는 3D 화면(WebGL)을 사용할 수 없습니다. 다른 브라우저로 접속해 주세요.');
    return false;
  }
}

function onPick(id) {
  if (state.mode === 'gallery') return openViewer(id);
  const ex = state.board.find((e) => e.id === id);
  if (!ex) return;
  if (ex.state === 'ended') return toast('종료된 전시회입니다.');
  if (ex.state === 'upcoming') return toast(`아직 열리지 않은 전시회입니다.${ex.starts_on ? ` ${fmtDate(ex.starts_on)}에 열립니다.` : ''}`);
  openEntry(ex);
}

function showHud(title, hintExtra) {
  $('exName').textContent = title;
  $('entry').hidden = true;
  $('board').hidden = true;
  $('hud').hidden = false;
  const touch = matchMedia('(pointer: coarse)').matches;
  const hint = $('hint');
  hint.textContent = (touch ? '조이스틱으로 이동 · 화면을 밀어 둘러보기 · ' : 'W A S D / 방향키로 이동 · 드래그로 둘러보기 · ') + hintExtra;
  hint.classList.remove('fade');
  state.timers.push(setTimeout(() => hint.classList.add('fade'), 9000));
}

// 진행 중인 타이머와 실시간 연결을 정리한다 (로비 ↔ 전시실 이동, 나가기)
function teardown() {
  state.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  state.timers = [];
  if (state.channel) {
    sb.removeChannel(state.channel);
    state.channel = null;
    state.live = false;
  }
  if (world) world.clearRemotes();
  state.exhibition = null;
  state.mode = null;
}

// ───────────── 1층 로비 (3D): 전시회 포스터가 걸려 있다 ─────────────

const POSTER_COLORS = [
  ['#1f1f21', '#ffffff'], ['#b4553a', '#fff3e6'], ['#e9e4da', '#1c1b1a'],
  ['#2f4a5c', '#eef6fb'], ['#c9b28a', '#2a2118'], ['#4a5a44', '#f1f6ea'],
];
function drawPoster(ex, index) {
  const c = document.createElement('canvas');
  c.width = 600;
  c.height = 900;
  const ctx = c.getContext('2d');
  const [bg, fg] = POSTER_COLORS[index % POSTER_COLORS.length];
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 600, 900);
  ctx.fillStyle = fg;
  ctx.font = '600 24px system-ui, sans-serif';
  ctx.fillText('E X H I B I T I O N', 48, 96);
  ctx.fillRect(48, 120, 90, 5);
  ctx.font = '800 76px "Pretendard", system-ui, "Apple SD Gothic Neo", "Malgun Gothic", sans-serif';
  const lines = [];
  let line = '';
  for (const ch of ex.name) {
    if (ctx.measureText(line + ch).width > 500) {
      lines.push(line);
      line = ch === ' ' ? '' : ch;
    } else line += ch;
  }
  if (line) lines.push(line);
  lines.slice(0, 6).forEach((l, i) => ctx.fillText(l, 48, 560 + (i - Math.min(lines.length, 6) + 3) * 92));
  ctx.font = '500 28px system-ui, sans-serif';
  ctx.fillText(period(ex), 48, 850);
  return c;
}

function lobbyItems() {
  const order = { active: 0, upcoming: 1, ended: 2 };
  return [...state.board]
    .sort((a, b) => order[a.state] - order[b.state])
    .map((ex, i) => ({
      id: ex.id, w: 2, h: 3, title: ex.name,
      author: `${STATE_LABEL[ex.state]} · ${period(ex)} · 작품 ${ex.artworks}점`,
      thumb: ex.poster || null, image: ex.poster || null,
      canvas: ex.poster ? null : drawPoster(ex, i),
      dim: ex.state === 'ended', hearts: 0,
      rev: `${ex.state}|${ex.poster}|${ex.name}|${ex.artworks}|${ex.starts_on}|${ex.ends_on}`,
    }));
}

async function enterLobby() {
  const name = $('name').value.trim();
  const err = $('profileError');
  err.hidden = !!name;
  err.textContent = '이름을 입력해 주세요.';
  if (!name) return $('name').focus();
  if (!ensureWorld()) return;
  state.name = name;
  store.set('gallery.name', name);
  store.set('gallery.avatar', avatarId(state.animal, state.color));
  await loadBoard();
  teardown();
  state.mode = 'lobby';
  world.setLobby(true);
  world.setTheme('white');
  world.setTitle('전시 안내', 'LOBBY · 1F');
  world.setSelf({ name, avatar: avatarId(state.animal, state.color) });
  world.resetPose();
  world.setArtworks(lobbyItems(), imageUrl);
  world.paused = false;
  world.start();
  document.title = '1층 로비 · 온라인 전시관';
  $('uploadBtn').hidden = true;
  showHud('1층 로비', '포스터를 누르면 전시실로 입장');
  if (!state.board.length) toast('아직 등록된 전시회가 없습니다.');
  joinRealtime('gallery:lobby');
  state.timers.push(setInterval(async () => {
    await loadBoard();
    if (state.mode === 'lobby') world.setArtworks(lobbyItems(), imageUrl);
  }, 60000));
}
$('lobbyBtn').addEventListener('click', enterLobby);

// ───────────── 전시실 ─────────────

function enterGallery(data) {
  if (!ensureWorld()) return;
  state.mode = 'gallery';
  world.setLobby(false);
  world.setTheme(data.theme || 'white');
  world.setTitle(data.exhibition.name, 'EXHIBITION');
  world.setSelf({ name: state.name, avatar: avatarId(state.animal, state.color) });
  world.resetPose();
  applyData(data);
  world.paused = false;
  world.start();
  document.title = `${data.exhibition.name} · 온라인 전시관`;
  showHud(data.exhibition.name, '작품을 누르면 크게 보기');

  if (data.student?.issued) {
    $('issuedCode').textContent = data.student.code;
    world.paused = true;
    $('issued').hidden = false;
  } else if (!data.artworks.length) {
    toast(data.role === 'student' ? '아직 작품이 없습니다. 첫 작품을 올려 보세요!' : '아직 전시된 작품이 없습니다.');
  }
  joinRealtime(`gallery:${data.exhibition.id}`);
  state.timers.push(setInterval(() => refresh(), 40000));
}

async function refresh() {
  if (state.mode !== 'gallery') return;
  try {
    const data = await rpc('enter', { p_code: state.code, p_visitor: visitorId, p_name: state.name });
    if (state.mode !== 'gallery') return;
    if (data.error) {
      leave(data.error === 'ended' ? '전시회가 종료되었습니다.' : '입장 코드가 더 이상 유효하지 않습니다.');
      return;
    }
    applyData(data);
    if (state.viewing && !data.artworks.some((a) => a.id === state.viewing)) closeModals();
  } catch (err) {
    console.warn(err);
  }
}

// 나가기: 전시실 → (로비에서 왔으면) 로비, 로비 → 첫 화면
function leave(message) {
  const backToLobby = state.mode === 'gallery' && state.from === 'lobby';
  teardown();
  closeModals();
  if (message) toast(message);
  if (backToLobby) return enterLobby();
  if (world) world.stop();
  $('hud').hidden = true;
  $('board').hidden = false;
  document.title = '온라인 3D 전시관';
  loadBoard();
}

$('exitBtn').addEventListener('click', () => leave());

// ───────────── 실시간 (다른 관람객, 하트, 새 작품) ─────────────

function send(event, payload) {
  if (state.live) state.channel?.send({ type: 'broadcast', event, payload });
}

function joinRealtime(channelName) {
  const ch = sb.channel(channelName, {
    config: { broadcast: { self: false }, presence: { key: sessionId } },
  });
  state.channel = ch;

  ch.on('presence', { event: 'sync' }, () => {
    const all = ch.presenceState();
    const ids = Object.keys(all);
    $('online').textContent = `관람객 ${Math.max(ids.length, 1)}명`;
    for (const id of ids) {
      if (id === sessionId) continue;
      const meta = all[id][0];
      if (meta) world.upsertRemote(id, meta);
    }
    for (const id of [...world.remotes.keys()]) {
      if (!all[id]) world.removeRemote(id);
    }
  });
  // 새로 들어온 사람이 내 현재 위치를 알 수 있게 다시 알림
  ch.on('presence', { event: 'join' }, () => send('pos', { id: sessionId, ...world.getPose() }));
  ch.on('broadcast', { event: 'pos' }, ({ payload }) => world.moveRemote(payload.id, payload));
  ch.on('broadcast', { event: 'heart' }, ({ payload }) => {
    if (state.mode !== 'gallery') return;
    const art = state.artworks.find((a) => a.id === payload.id);
    if (art) art.hearts = payload.hearts;
    world.setHearts(payload.id, payload.hearts);
    if (state.viewing === payload.id) $('heartCount').textContent = payload.hearts;
  });
  ch.on('broadcast', { event: 'refresh' }, () => refresh());
  const myMode = state.mode;

  ch.subscribe((status) => {
    state.live = status === 'SUBSCRIBED';
    if (state.live) {
      ch.track({ name: state.name, avatar: avatarId(state.animal, state.color), ...world.getPose() });
    }
  });

  let last = '';
  let idle = 0;
  state.timers.push(setInterval(() => {
    if (state.mode !== myMode) return;
    const pose = world.getPose();
    const key = `${pose.x},${pose.z},${pose.ry}`;
    idle++;
    if (key !== last || idle >= 30) {
      last = key;
      idle = 0;
      send('pos', { id: sessionId, ...pose });
    }
  }, 100));
}

// ───────────── 작품 크게 보기 + 하트 ─────────────

function openViewer(id) {
  const art = state.artworks.find((a) => a.id === id);
  if (!art) return;
  state.viewing = id;
  world.paused = true;
  const img = $('viewerImg');
  img.src = imageUrl(art.thumb);
  const full = new Image();
  full.onload = () => { if (state.viewing === id) img.src = full.src; };
  full.src = imageUrl(art.image);
  img.alt = art.title || '작품';
  $('viewerTitle').textContent = art.title || '무제';
  $('viewerAuthor').textContent = art.author || '';
  $('heartCount').textContent = art.hearts;
  $('heartBtn').setAttribute('aria-pressed', String(!!art.hearted));
  $('deleteBtn').hidden = !art.mine;
  $('viewer').hidden = false;
}

function closeModals() {
  state.viewing = null;
  for (const id of ['viewer', 'uploader', 'issued', 'entry']) $(id).hidden = true;
  if (world) world.paused = false;
}

for (const el of document.querySelectorAll('[data-close]')) el.addEventListener('click', closeModals);
for (const m of document.querySelectorAll('.modal')) {
  m.addEventListener('click', (e) => { if (e.target === m || e.target.classList.contains('viewer-body')) closeModals(); });
}
window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModals(); });

$('heartBtn').addEventListener('click', async () => {
  const id = state.viewing;
  const art = state.artworks.find((a) => a.id === id);
  if (!art) return;
  const btn = $('heartBtn');
  btn.disabled = true;
  try {
    const res = await rpc('toggle_heart', { p_code: state.code, p_artwork: id, p_visitor: visitorId });
    if (res.error) return toast('하트를 붙일 수 없습니다.');
    art.hearts = res.hearts;
    art.hearted = res.hearted;
    world.setHearts(id, res.hearts);
    send('heart', { id, hearts: res.hearts });
    if (state.viewing === id) {
      $('heartCount').textContent = res.hearts;
      btn.setAttribute('aria-pressed', String(res.hearted));
    }
  } catch (err) {
    console.error(err);
    toast('잠시 후 다시 시도해 주세요.');
  } finally {
    btn.disabled = false;
  }
});

$('deleteBtn').addEventListener('click', async () => {
  const id = state.viewing;
  if (!id || !confirm('이 작품을 전시에서 삭제할까요?')) return;
  const res = await fn({ action: 'delete_artwork', code: state.code, artwork_id: id });
  if (res.error) return toast('삭제하지 못했습니다.');
  await refresh();
  closeModals();
  send('refresh', {});
  toast('작품을 삭제했습니다.');
});

// ───────────── 작품 올리기 (수강생) ─────────────

let picked = null; // { image: Blob, thumb: Blob, w, h }

async function loadBitmap(file) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

function resizeToJpeg(src, max, quality) {
  const scale = Math.min(1, max / Math.max(src.width, src.height));
  const w = Math.max(1, Math.round(src.width * scale));
  const h = Math.max(1, Math.round(src.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, w, h);
  return new Promise((resolve) => c.toBlob((blob) => resolve({ blob, w, h }), 'image/jpeg', quality));
}

function showUploadError(msg) {
  const el = $('uploadError');
  el.textContent = msg;
  el.hidden = !msg;
}

function quotaLeft() {
  const mine = state.artworks.filter((a) => a.mine).length;
  return Math.max(0, state.exhibition.max_per_student - mine);
}

$('uploadBtn').addEventListener('click', () => {
  const left = quotaLeft();
  const max = state.exhibition.max_per_student;
  picked = null;
  $('uploadForm').reset();
  $('preview').hidden = true;
  $('fileHint').hidden = false;
  $('artAuthor').value = state.student?.name || state.name;
  $('quota').textContent = `${left > 0
    ? `1인 최대 ${max}점 · 앞으로 ${left}점 더 올릴 수 있습니다.`
    : `올릴 수 있는 작품 수(${max}점)를 모두 채웠습니다. 작품을 터치해 삭제한 뒤 다시 올릴 수 있습니다.`} 내 개인 코드: ${state.code}`;
  $('submitArt').disabled = left <= 0;
  showUploadError('');
  world.paused = true;
  $('uploader').hidden = false;
});

$('file').addEventListener('change', async () => {
  const file = $('file').files[0];
  picked = null;
  if (!file) return;
  showUploadError('');
  try {
    const bmp = await loadBitmap(file);
    const image = await resizeToJpeg(bmp, 2048, 0.88);
    const thumb = await resizeToJpeg(bmp, 512, 0.8);
    picked = { image: image.blob, thumb: thumb.blob, w: image.w, h: image.h };
    const prev = $('preview');
    prev.src = URL.createObjectURL(thumb.blob);
    prev.hidden = false;
    $('fileHint').hidden = true;
  } catch (err) {
    console.error(err);
    showUploadError('이미지를 읽을 수 없습니다. JPG, PNG, WEBP 파일을 선택해 주세요.');
  }
});

const UPLOAD_ERRORS = {
  limit: '올릴 수 있는 작품 수를 모두 채웠습니다.',
  ended: '종료된 전시회에는 작품을 올릴 수 없습니다.',
  not_found: '수강생 코드가 유효하지 않습니다.',
  too_large: '이미지 용량이 너무 큽니다.',
};

$('uploadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!picked) return showUploadError('먼저 이미지를 선택해 주세요.');
  const btn = $('submitArt');
  btn.disabled = true;
  btn.textContent = '올리는 중…';
  showUploadError('');
  try {
    const form = new FormData();
    form.append('code', state.code);
    form.append('title', $('artTitle').value.trim());
    form.append('author', $('artAuthor').value.trim());
    form.append('w', picked.w);
    form.append('h', picked.h);
    form.append('image', new File([picked.image], 'image.jpg', { type: 'image/jpeg' }));
    form.append('thumb', new File([picked.thumb], 'thumb.jpg', { type: 'image/jpeg' }));
    const res = await fnUpload(form);
    if (res.error) {
      showUploadError(UPLOAD_ERRORS[res.error] || '업로드에 실패했습니다. 잠시 후 다시 시도해 주세요.');
      return;
    }
    await refresh();
    closeModals();
    send('refresh', {});
    toast('작품이 전시되었습니다!');
  } catch (err) {
    console.error(err);
    showUploadError('업로드에 실패했습니다. 네트워크 상태를 확인해 주세요.');
  } finally {
    btn.disabled = false;
    btn.textContent = '전시하기';
  }
});

// ───────────── 시작 ─────────────

window.addEventListener('pagehide', () => {
  if (state.channel) sb.removeChannel(state.channel);
});

buildAvatarPicker();
$('name').value = store.get('gallery.name') || '';
loadBoard();
// 입장 링크(?code=)로 들어오면 바로 입장 창을 연다
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) openEntry(null, urlCode.toUpperCase());
$('name').addEventListener('input', () => { $('profileError').hidden = true; });

// ───────────── 홈 화면 설치 (PWA) ─────────────

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
let installEvent = null;
window.addEventListener('beforeinstallprompt', (e) => {
  // 안드로이드/크롬: 설치 버튼을 보여 준다
  e.preventDefault();
  installEvent = e;
  $('installBtn').hidden = false;
});
$('installBtn').addEventListener('click', async () => {
  if (!installEvent) return;
  installEvent.prompt();
  await installEvent.userChoice.catch(() => {});
  installEvent = null;
  $('installBtn').hidden = true;
});
window.addEventListener('appinstalled', () => { $('installBtn').hidden = true; });
// 아이폰 사파리는 설치 창을 띄울 수 없어 방법을 안내한다
if (!standalone && /iphone|ipad|ipod/i.test(navigator.userAgent)) $('iosHint').hidden = false;
