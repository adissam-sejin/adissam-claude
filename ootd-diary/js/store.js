// 데이터 저장소: IndexedDB에 저장하고 메모리에 캐시한다.
// 사진을 포함한 모든 데이터는 이 브라우저 안에만 저장된다.

const DB_NAME = 'ootd-diary';
const DB_VER = 1;

export const state = {
  items: [],      // 옷장 아이템
  logs: {},       // 'YYYY-MM-DD' -> 착용 기록
  settings: {},   // 위치, 수동 기온 등
  persistent: true,
};

let db = null;

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains('items')) d.createObjectStore('items', { keyPath: 'id' });
      if (!d.objectStoreNames.contains('logs')) d.createObjectStore('logs', { keyPath: 'date' });
      if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx(store, mode, fn) {
  if (!db) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const out = fn(t.objectStore(store));
    t.oncomplete = () => resolve(out && out.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

const getAll = (store) => tx(store, 'readonly', (s) => s.getAll());

export async function load() {
  try {
    db = await openDb();
    const [items, logs, settings] = await Promise.all([
      getAll('items'),
      getAll('logs'),
      tx('kv', 'readonly', (s) => s.get('settings')),
    ]);
    state.items = items || [];
    state.logs = Object.fromEntries((logs || []).map((l) => [l.date, l]));
    state.settings = settings || {};
    // 브라우저가 저장 공간을 임의로 비우지 않도록 요청
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (err) {
    console.warn('IndexedDB를 사용할 수 없어 임시 메모리에만 저장합니다.', err);
    db = null;
    state.persistent = false;
  }
}

export function saveItem(item) {
  const i = state.items.findIndex((x) => x.id === item.id);
  if (i >= 0) state.items[i] = item; else state.items.push(item);
  return tx('items', 'readwrite', (s) => s.put(item));
}

export function deleteItem(id) {
  state.items = state.items.filter((x) => x.id !== id);
  const touched = [];
  for (const log of Object.values(state.logs)) {
    if (log.itemIds.includes(id)) {
      log.itemIds = log.itemIds.filter((x) => x !== id);
      touched.push(log);
    }
  }
  touched.forEach((l) => saveLog(l));
  return tx('items', 'readwrite', (s) => s.delete(id));
}

const isEmptyLog = (l) => !l.itemIds.length && !l.note && !l.photo;

export function saveLog(log) {
  if (isEmptyLog(log)) {
    delete state.logs[log.date];
    return tx('logs', 'readwrite', (s) => s.delete(log.date));
  }
  state.logs[log.date] = log;
  return tx('logs', 'readwrite', (s) => s.put(log));
}

export function saveSettings(patch) {
  Object.assign(state.settings, patch);
  return tx('kv', 'readwrite', (s) => s.put(state.settings, 'settings'));
}

export function kvGet(key) { return tx('kv', 'readonly', (s) => s.get(key)); }
export function kvSet(key, value) { return tx('kv', 'readwrite', (s) => s.put(value, key)); }

export async function replaceAll(data) {
  state.items = data.items || [];
  state.logs = Object.fromEntries(Object.values(data.logs || {}).map((l) => [l.date, l]));
  state.settings = data.settings || {};
  if (!db) return;
  await tx('items', 'readwrite', (s) => { s.clear(); state.items.forEach((i) => s.put(i)); });
  await tx('logs', 'readwrite', (s) => { s.clear(); Object.values(state.logs).forEach((l) => s.put(l)); });
  await tx('kv', 'readwrite', (s) => { s.clear(); s.put(state.settings, 'settings'); });
}

// 아이템별 착용 횟수와 마지막 착용일
export function wearStats() {
  const map = new Map();
  for (const log of Object.values(state.logs)) {
    for (const id of log.itemIds) {
      const cur = map.get(id) || { count: 0, last: '' };
      cur.count += 1;
      if (log.date > cur.last) cur.last = log.date;
      map.set(id, cur);
    }
  }
  return map;
}

export const itemById = (id) => state.items.find((x) => x.id === id);
