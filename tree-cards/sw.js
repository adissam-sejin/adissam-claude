// 홈 화면 앱으로 설치할 수 있게 해주는 최소한의 서비스 워커.
// 화면과 데이터는 항상 서버에서 새로 받는다(아무것도 저장해 두지 않음).
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
self.addEventListener("fetch", () => {});
