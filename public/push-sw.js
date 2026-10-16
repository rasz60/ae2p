// 웹 푸시 수신 (workbox 가 만든 sw.js 에서 importScripts 로 불러온다)
// 보내는 쪽: 각 앱의 서버 (업무일지 = kingtepad apps/api/src/notifier.ts)
// payload: { title, body, url, tag, badge } — url 은 앱 경로까지 포함한 주소 (예: /diary/tasks/…)

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    (async () => {
      await self.registration.showNotification(data.title || 'ae:p', {
        body: data.body || '',
        icon: '/pwa-192x192.png',
        badge: '/pwa-64x64.png',
        tag: data.tag,
        data: { url: data.url || '/' },
      });
      // 앱 아이콘 숫자 = 읽지 않은 알림 수
      if (typeof data.badge === 'number' && self.navigator.setAppBadge) {
        await (data.badge > 0 ? self.navigator.setAppBadge(data.badge) : self.navigator.clearAppBadge());
      }
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/', self.location.origin).href;
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const win = windows.find((w) => 'focus' in w);
      if (win) {
        await win.focus();
        if ('navigate' in win) await win.navigate(url);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});
