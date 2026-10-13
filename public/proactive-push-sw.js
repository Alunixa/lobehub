self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('push', (event) => {
  event.waitUntil(
    (async () => {
      let payload;
      try {
        payload = event.data?.json();
      } catch {
        return;
      }
      if (!payload || typeof payload.title !== 'string' || typeof payload.url !== 'string') return;
      const url = new URL(payload.url, self.location.origin);
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/agent/')) return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const active = windows.find((client) => client.visibilityState === 'visible');
      if (active) {
        active.postMessage({
          type: 'proactive-notification',
          payload: { ...payload, url: url.href },
        });
        return;
      }
      await self.registration.showNotification(payload.title, {
        body: typeof payload.body === 'string' ? payload.body : '',
        data: { url: url.href },
        icon: '/icons/icon-192x192.png',
        tag: `proactive:${payload.id}`,
      });
    })(),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    (async () => {
      const url = new URL(event.notification.data?.url || '/', self.location.origin);
      if (url.origin !== self.location.origin || !url.pathname.startsWith('/agent/')) return;
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const client = windows.find((window) => new URL(window.url).origin === self.location.origin);
      if (client) {
        await client.navigate(url.href);
        await client.focus();
      } else await self.clients.openWindow(url.href);
    })(),
  );
});
