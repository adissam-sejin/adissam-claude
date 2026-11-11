import { sb, rpc, imageUrl, fn, fnUpload } from './api.js';
import { AVATARS, renderAvatarPreviews } from './avatars.js';
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

const state = {
  code: '', name: '', avatar: store.get('gallery.avatar') || AVATARS[0].id,
  role: 'visitor', exhibition: null, student: null, artworks: [],
  channel: null, timers: [], viewing: null,
};
let world = null;

// ───────────── 입장 화면 ─────────────

function buildAvatarPicker() {
  const wrap = $('avatars');
  let previews = {};
  try { previews = renderAvatarPreviews(160); } catch { /* WebGL 불가 시 이름만 표시 */ }
  for (const a of AVATARS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'radio');
    b.dataset.id = a.id;
    if (previews[a.id]) {
      const img = document.createElement('img');
      img.src = previews[a.id];
      img.alt = '';
      b.append(img);
    }
    b.append(a.name);
    b.addEventListener('click', () => selectAvatar(a.id));
    wrap.append(b);
  }
  selectAvatar(AVATARS.some((a) => a.id === state.avatar) ? state.avatar : AVATARS[0].id);
}

function selectAvatar(id) {
  state.avatar = id;
  for (const b of $('avatars').children) b.setAttribute('aria-checked', String(b.dataset.id === id));
}

function showEntryError(msg) {
  const el = $('entryError');
  el.textContent = msg;
  el.hidden = !msg;
}

const ENTER_ERRORS = {
  not_found: '코드를 찾을 수 없습니다. 입장 코드를 다시 확인해 주세요.',
  ended: '종료된 전시회입니다.',
};

$('entryForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const code = $('code').value.replace(/\s/g, '').toUpperCase();
  const name = $('name').value.trim();
  if (!code || !name) return;
  showEntryError('');
  const btn = $('enterBtn');
  btn.disabled = true;
  btn.textContent = '입장 중…';
  try {
    const data = await rpc('enter', { p_code: code, p_visitor: visitorId });
    if (data.error) {
      showEntryError(data.error === 'ended' ? `「${data.name}」 전시회는 종료되었습니다.` : ENTER_ERRORS[data.error]);
      return;
    }
    state.code = code;
    state.name = name;
    store.set('gallery.name', name);
    store.set('gallery.avatar', state.avatar);
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

function enterGallery(data) {
  if (!world) {
    try {
      world = new World({ canvas: $('scene'), joystick: $('joystick'), onPick: openViewer });
    } catch (err) {
      console.error(err);
      showEntryError('이 기기에서는 3D 화면(WebGL)을 사용할 수 없습니다. 다른 브라우저로 접속해 주세요.');
      return;
    }
  }
  world.setTitle(data.exhibition.name);
  world.setSelf({ name: state.name, avatar: state.avatar });
  applyData(data);
  world.paused = false;
  world.start();

  $('exName').textContent = data.exhibition.name;
  document.title = `${data.exhibition.name} · 온라인 전시관`;
  $('entry').hidden = true;
  $('hud').hidden = false;

  const touch = matchMedia('(pointer: coarse)').matches;
  const hint = $('hint');
  hint.textContent = touch
    ? '조이스틱으로 이동 · 화면을 밀어 둘러보기 · 작품을 터치하면 크게 보기'
    : 'W A S D / 방향키로 이동 · 드래그로 둘러보기 · 작품을 클릭하면 크게 보기';
  hint.classList.remove('fade');
  state.timers.push(setTimeout(() => hint.classList.add('fade'), 9000));

  if (!data.artworks.length) {
    toast(data.role === 'student' ? '아직 작품이 없습니다. 첫 작품을 올려 보세요!' : '아직 전시된 작품이 없습니다.');
  }
  joinRealtime();
  state.timers.push(setInterval(() => refresh(), 40000));
}

async function refresh() {
  if (!state.exhibition) return;
  try {
    const data = await rpc('enter', { p_code: state.code, p_visitor: visitorId });
    if (!state.exhibition) return;
    if (data.error) {
      leaveGallery(data.error === 'ended' ? '전시회가 종료되었습니다.' : '입장 코드가 더 이상 유효하지 않습니다.');
      return;
    }
    applyData(data);
    if (state.viewing && !data.artworks.some((a) => a.id === state.viewing)) closeModals();
  } catch (err) {
    console.warn(err);
  }
}

function leaveGallery(message) {
  state.timers.forEach((t) => { clearTimeout(t); clearInterval(t); });
  state.timers = [];
  if (state.channel) {
    sb.removeChannel(state.channel);
    state.channel = null;
    state.live = false;
  }
  if (world) {
    world.stop();
    for (const id of [...world.remotes.keys()]) world.removeRemote(id);
  }
  state.exhibition = null;
  closeModals();
  $('hud').hidden = true;
  $('entry').hidden = false;
  document.title = '온라인 3D 전시관';
  showEntryError(message || '');
}

$('exitBtn').addEventListener('click', () => leaveGallery());

// ───────────── 실시간 (다른 관람객, 하트, 새 작품) ─────────────

function send(event, payload) {
  if (state.live) state.channel?.send({ type: 'broadcast', event, payload });
}

function joinRealtime() {
  const ch = sb.channel(`gallery:${state.exhibition.id}`, {
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
    const art = state.artworks.find((a) => a.id === payload.id);
    if (art) art.hearts = payload.hearts;
    world.setHearts(payload.id, payload.hearts);
    if (state.viewing === payload.id) $('heartCount').textContent = payload.hearts;
  });
  ch.on('broadcast', { event: 'refresh' }, () => refresh());

  ch.subscribe((status) => {
    state.live = status === 'SUBSCRIBED';
    if (state.live) {
      ch.track({ name: state.name, avatar: state.avatar, ...world.getPose() });
    }
  });

  let last = '';
  let idle = 0;
  state.timers.push(setInterval(() => {
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
  $('viewer').hidden = true;
  $('uploader').hidden = true;
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
  closeModals();
  await refresh();
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
  const sw = src.width;
  const sh = src.height;
  const scale = Math.min(1, max / Math.max(sw, sh));
  const w = Math.max(1, Math.round(sw * scale));
  const h = Math.max(1, Math.round(sh * scale));
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
  picked = null;
  $('uploadForm').reset();
  $('preview').hidden = true;
  $('fileHint').hidden = false;
  $('artAuthor').value = state.student?.name || state.name;
  $('quota').textContent = left > 0
    ? `1인 최대 ${state.exhibition.max_per_student}점 · 앞으로 ${left}점 더 올릴 수 있습니다.`
    : `올릴 수 있는 작품 수(${state.exhibition.max_per_student}점)를 모두 채웠습니다. 작품을 터치해 삭제한 뒤 다시 올릴 수 있습니다.`;
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

// ───────────── 기타 ─────────────

let toastTimer;
function toast(msg) {
  const el = $('toast');
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 3500);
}

window.addEventListener('pagehide', () => {
  if (state.channel) sb.removeChannel(state.channel);
});

buildAvatarPicker();
$('name').value = store.get('gallery.name') || '';
const urlCode = new URLSearchParams(location.search).get('code');
if (urlCode) $('code').value = urlCode.toUpperCase();
