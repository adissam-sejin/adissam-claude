// 홈 화면에 추가(설치)할 수 있게 해 주는 최소한의 서비스 워커.
// 아무것도 저장(캐시)하지 않습니다 — 주보는 항상 서버에서 새로 받아 옵니다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
