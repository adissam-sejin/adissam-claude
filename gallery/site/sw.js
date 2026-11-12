// 홈 화면 설치(PWA)를 위한 최소한의 서비스 워커.
// 항상 최신 화면을 보여 주도록 캐시는 하지 않고 네트워크로 그대로 보낸다.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => {});
