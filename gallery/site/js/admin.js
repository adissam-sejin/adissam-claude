import { rpc, imageUrl, fn } from './api.js';

const $ = (id) => document.getElementById(id);
const TOKEN_KEY = 'gallery.admin';
let token = sessionStorage.getItem(TOKEN_KEY);
let setupMode = false;
const openState = new Map(); // 접힘 상태 유지: `${전시회id}:${섹션}` -> boolean

function el(tag, props = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) node.setAttribute(k, v === true ? '' : v);
  }
  node.append(...children.filter((c) => c != null));
  return node;
}

let toastTimer;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.hidden = true; }, 3000);
}

async function copy(text, label) {
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} 복사했습니다.`);
  } catch {
    prompt('아래 내용을 복사하세요.', text);
  }
}

// 관리자 RPC 호출. 세션이 만료되면 로그인 화면으로 돌아간다.
async function call(name, args = {}) {
  try {
    return await rpc(name, { p_token: token, ...args });
  } catch (err) {
    if (/UNAUTHORIZED/.test(err.message)) {
      sessionStorage.removeItem(TOKEN_KEY);
      token = null;
      showAuth();
      throw new Error('세션이 만료되었습니다. 다시 로그인해 주세요.');
    }
    throw err;
  }
}

const entryUrl = (code) => `${new URL('./', location.href).href}?code=${code}`;

// ───────────── 로그인 ─────────────

async function showAuth() {
  $('app').hidden = true;
  $('auth').hidden = false;
  const status = await rpc('admin_status');
  setupMode = !status.initialized;
  $('authTitle').textContent = setupMode ? '관리자 비밀번호 설정' : '관리자 로그인';
  $('authSub').textContent = setupMode
    ? '처음 접속하셨습니다. 앞으로 사용할 관리자 비밀번호(8자 이상)를 정해 주세요.'
    : '관리자 비밀번호를 입력하세요.';
  $('pw2Wrap').hidden = !setupMode;
  $('pw').autocomplete = setupMode ? 'new-password' : 'current-password';
  $('authBtn').textContent = setupMode ? '설정하고 시작하기' : '로그인';
}

function authError(msg) {
  $('authError').textContent = msg;
  $('authError').hidden = !msg;
}

const AUTH_ERRORS = {
  wrong_password: '비밀번호가 올바르지 않습니다.',
  locked: '여러 번 틀려 잠시 잠겼습니다. 1분 뒤 다시 시도해 주세요.',
  weak_password: '비밀번호는 8자 이상이어야 합니다.',
  already_initialized: '이미 비밀번호가 설정되어 있습니다. 새로고침 후 로그인해 주세요.',
  not_initialized: '아직 비밀번호가 설정되지 않았습니다. 새로고침해 주세요.',
};

$('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  authError('');
  const pw = $('pw').value;
  if (setupMode && pw !== $('pw2').value) return authError('두 비밀번호가 서로 다릅니다.');
  $('authBtn').disabled = true;
  try {
    const res = await rpc(setupMode ? 'admin_setup' : 'admin_login', { p_password: pw });
    if (res.error) return authError(AUTH_ERRORS[res.error] || '로그인하지 못했습니다.');
    token = res.token;
    sessionStorage.setItem(TOKEN_KEY, token);
    $('pw').value = $('pw2').value = '';
    showApp();
  } catch (err) {
    authError('접속에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    console.error(err);
  } finally {
    $('authBtn').disabled = false;
  }
});

$('logoutBtn').addEventListener('click', async () => {
  await rpc('admin_logout', { p_token: token }).catch(() => {});
  sessionStorage.removeItem(TOKEN_KEY);
  token = null;
  showAuth();
});

$('pwBtn').addEventListener('click', async () => {
  const oldPw = prompt('현재 비밀번호를 입력하세요.');
  if (!oldPw) return;
  const newPw = prompt('새 비밀번호를 입력하세요. (8자 이상)');
  if (!newPw) return;
  try {
    const res = await call('admin_change_password', { p_old: oldPw, p_new: newPw });
    toast(res.error ? AUTH_ERRORS[res.error] : '비밀번호를 변경했습니다.');
  } catch (err) {
    toast(err.message);
  }
});

// ───────────── 전시회 목록 ─────────────

async function showApp() {
  $('auth').hidden = true;
  $('app').hidden = false;
  await load();
}

async function load() {
  try {
    render(await call('admin_list'));
  } catch (err) {
    toast(err.message);
  }
}

async function act(promise, okMsg) {
  try {
    const res = await promise;
    if (res && res.error) throw new Error('요청을 처리하지 못했습니다.');
    if (okMsg) toast(okMsg);
    await load();
  } catch (err) {
    toast(err.message || '요청을 처리하지 못했습니다.');
  }
}

function section(ex, key, title, count, ...body) {
  const id = `${ex.id}:${key}`;
  const d = el('details', { open: openState.get(id) ?? false },
    el('summary', {}, title, el('span', {}, count)), ...body);
  d.addEventListener('toggle', () => openState.set(id, d.open));
  return d;
}

function renderCodes(ex) {
  const rows = ex.codes.map((c) => {
    const input = el('input', { value: c.student_name, maxlength: 30, placeholder: '이름 없음', 'aria-label': '수강생 이름' });
    input.addEventListener('change', () => act(call('admin_update_code', { p_code_id: c.id, p_name: input.value }), '이름을 저장했습니다.'));
    return el('tr', {},
      el('td', {}, el('span', { class: 'code' }, c.code)),
      el('td', {}, input),
      el('td', { class: 'num' }, `${c.used} / ${ex.max_per_student}`),
      el('td', {},
        el('button', { class: 'btn small', onclick: () => copy(entryUrl(c.code), '수강생 입장 링크를') }, '링크'),
        ' ',
        el('button', {
          class: 'btn small danger',
          onclick: () => {
            if (confirm(`코드 ${c.code}를 삭제할까요?\n이미 올린 작품은 전시에 남습니다.`)) {
              act(call('admin_delete_code', { p_code_id: c.id }), '코드를 삭제했습니다.');
            }
          },
        }, '삭제')),
    );
  });

  const countInput = el('input', { type: 'number', min: 1, max: 300, value: 5, id: `add-${ex.id}` });
  const addForm = el('form', { class: 'row-form' },
    el('div', {}, el('label', { for: `add-${ex.id}` }, '코드 추가 개수'), countInput),
    el('button', { class: 'btn small primary', type: 'submit' }, '코드 추가'),
    el('button', {
      class: 'btn small', type: 'button',
      onclick: () => copy(ex.codes.map((c) => `${c.code}\t${c.student_name}`).join('\n'), '수강생 코드 목록을'),
    }, '전체 코드 복사'),
  );
  addForm.addEventListener('submit', (e) => {
    e.preventDefault();
    act(call('admin_add_codes', { p_exhibition: ex.id, p_count: Number(countInput.value) || 0 }), '코드를 추가했습니다.');
  });

  return section(ex, 'codes', '수강생 코드', `${ex.codes.length}개`,
    ex.codes.length ? el('div', { class: 'table-wrap' },
      el('table', {},
        el('thead', {}, el('tr', {}, el('th', {}, '코드'), el('th', {}, '수강생 이름'), el('th', {}, '올린 작품'), el('th', {}, ''))),
        el('tbody', {}, ...rows))) : null,
    addForm);
}

function renderArtworks(ex) {
  const cards = ex.artworks.map((a) => el('div', { class: 'art' },
    el('img', { src: imageUrl(a.thumb_path), alt: a.title || '작품', loading: 'lazy' }),
    el('button', {
      'aria-label': '작품 삭제', title: '작품 삭제',
      onclick: () => {
        if (confirm(`「${a.title || '무제'}」 작품을 삭제할까요?`)) {
          act(fn({ action: 'delete_artwork', token, artwork_id: a.id }), '작품을 삭제했습니다.');
        }
      },
    }, '✕'),
    el('p', {}, el('b', {}, a.title || '무제'), el('span', {}, `${a.author_name || '이름 없음'} · ♥ ${a.hearts}`)),
  ));
  return section(ex, 'arts', '전시 작품', `${ex.artworks.length}점`,
    cards.length ? el('div', { class: 'art-grid' }, ...cards) : el('p', { class: 'ex-meta' }, '아직 올라온 작품이 없습니다.'));
}

function render(list) {
  const wrap = $('list');
  wrap.replaceChildren();
  if (!list.length) {
    wrap.append(el('p', { class: 'empty' }, '아직 전시회가 없습니다. 위에서 첫 전시회를 만들어 보세요.'));
    return;
  }
  for (const ex of list) {
    const active = ex.status === 'active';
    const created = new Date(ex.created_at).toLocaleDateString('ko-KR');
    const maxInput = el('input', { type: 'number', min: 1, max: 50, value: ex.max_per_student, id: `max-${ex.id}` });
    const maxForm = el('form', { class: 'row-form' },
      el('div', {}, el('label', { for: `max-${ex.id}` }, '1인당 최대 작품 수'), maxInput),
      el('button', { class: 'btn small', type: 'submit' }, '저장'));
    maxForm.addEventListener('submit', (e) => {
      e.preventDefault();
      act(call('admin_update_exhibition', { p_id: ex.id, p_max_per_student: Number(maxInput.value) || 1 }), '저장했습니다.');
    });

    wrap.append(el('article', { class: 'ex' },
      el('div', { class: 'ex-head' },
        el('div', {},
          el('h3', {}, ex.name, el('span', { class: `badge ${ex.status}` }, active ? '진행중' : '종료')),
          el('div', { class: 'ex-meta' }, `${created} 생성 · 수강생 코드 ${ex.codes.length}개 · 작품 ${ex.artworks.length}점`)),
        el('div', { class: 'ex-buttons' },
          el('button', {
            class: 'btn small',
            onclick: () => {
              const name = prompt('전시회 이름', ex.name);
              if (name && name.trim() && name !== ex.name) act(call('admin_update_exhibition', { p_id: ex.id, p_name: name }), '이름을 변경했습니다.');
            },
          }, '이름 변경'),
          el('button', {
            class: `btn small ${active ? '' : 'primary'}`,
            onclick: () => {
              if (active && !confirm('전시회를 종료할까요?\n종료하면 코드를 입력해도 입장할 수 없습니다. (다시 진행중으로 되돌릴 수 있습니다)')) return;
              act(call('admin_update_exhibition', { p_id: ex.id, p_status: active ? 'ended' : 'active' }),
                active ? '전시회를 종료했습니다.' : '전시회를 다시 열었습니다.');
            },
          }, active ? '전시 종료하기' : '다시 진행하기'),
          el('button', {
            class: 'btn small danger',
            onclick: () => {
              if (prompt(`전시회와 모든 작품이 영구 삭제됩니다.\n삭제하려면 전시회 이름을 입력하세요:\n${ex.name}`) === ex.name) {
                act(fn({ action: 'delete_exhibition', token, exhibition_id: ex.id }), '전시회를 삭제했습니다.');
              }
            },
          }, '삭제'))),
      el('div', { class: 'code-box' },
        el('div', { class: 'grow' }, el('small', {}, '관람객 입장 코드'), el('span', { class: 'code' }, ex.visitor_code)),
        el('button', { class: 'btn small', onclick: () => copy(ex.visitor_code, '입장 코드를') }, '코드 복사'),
        el('button', { class: 'btn small', onclick: () => copy(entryUrl(ex.visitor_code), '관람객 입장 링크를') }, '입장 링크 복사')),
      maxForm,
      renderCodes(ex),
      renderArtworks(ex),
    ));
  }
}

$('createForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const names = $('newNames').value.split('\n').map((s) => s.trim()).filter(Boolean);
  try {
    const id = await call('admin_create_exhibition', {
      p_name: $('newName').value,
      p_max_per_student: Number($('newMax').value) || 3,
      p_student_count: names.length ? 0 : Number($('newCount').value) || 0,
      p_names: names.length ? names : null,
    });
    openState.set(`${id}:codes`, true);
    $('createForm').reset();
    toast('전시회를 만들었습니다.');
    await load();
  } catch (err) {
    toast(err.message);
  }
});

$('reloadBtn').addEventListener('click', load);

if (token) showApp();
else showAuth();
