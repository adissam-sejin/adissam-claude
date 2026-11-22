/* 하나님과의 대화 — 앱 껍데기와 성경을 기기에 담아 둡니다. 기록(/api)은 절대 담지 않습니다. */
const V = 'godtalk-v2';
const SHELL = ['/', '/manifest.webmanifest', '/favicon.ico', '/icons/icon-192.png', '/icons/icon-512.png', '/icons/apple-touch-icon.png', '/icons/avatar.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

const keep = async (key, res) => {
  if (res && (res.ok || res.type === 'opaque')) { const c = await caches.open(V); await c.put(key, res.clone()); }
  return res;
};

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mine = url.origin === self.location.origin;
  if (mine && (url.pathname === '/api' || url.pathname.startsWith('/api/') || url.pathname.startsWith('/.netlify/'))) return;

  /* 화면: 새 것을 먼저, 끊겼으면 담아 둔 것 */
  if (mine && req.mode === 'navigate') {
    e.respondWith(fetch(req).then((res) => keep('/', res)).catch(() => caches.match('/')));
    return;
  }
  /* 성경: 한 번 받으면 계속 담아 둔 것 */
  if (mine && url.pathname === '/bible.json') {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => keep(req, res))));
    return;
  }
  /* 그 밖의 그림·글꼴: 담아 둔 것을 주고 뒤에서 새로 받기 */
  if (mine || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.match(req).then((hit) => {
      const fresh = fetch(req).then((res) => keep(req, res)).catch(() => hit);
      return hit || fresh;
    }));
  }
});
