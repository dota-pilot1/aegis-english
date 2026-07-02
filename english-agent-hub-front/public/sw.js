// 자기소멸 서비스 워커.
// 인계 전 BeautyBook 사이트가 등록해 둔 서비스 워커가 dxline-tallent.com 방문자 브라우저에
// 남아 fetch를 가로채는 문제를 정리한다. 이 스크립트가 설치되면 캐시를 비우고 자신을 해지한 뒤
// 열린 탭을 새로고침해 서비스 워커 제어에서 빠져나오게 한다. (EAH 앱 자체는 SW를 쓰지 않는다.)
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {
        // 캐시 정리 실패는 무시
      }
      try {
        await self.registration.unregister();
      } catch (e) {
        // 해지 실패는 무시
      }
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach((client) => client.navigate(client.url));
    })()
  );
});
