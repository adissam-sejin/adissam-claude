// 홈 화면에 앱으로 저장할 수 있게 해 주는 최소한의 서비스 워커.
// 화면을 따로 저장해 두지 않는다 — 늘 인터넷에서 최신 화면을 받아 온다.
self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))
self.addEventListener('fetch', () => {})
