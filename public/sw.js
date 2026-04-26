/* Dashboard service worker. Handles Web Push delivery and click routing.
   Served at /dashboard/sw.js with scope /dashboard/. */

self.addEventListener('install', (e) => {
  // Take over immediately on first install so existing tabs start receiving
  // pushes without a manual reload.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: 'Dashboard alert', body: event.data ? event.data.text() : '' };
  }

  const title = payload.title || 'Dashboard alert';
  const opts = {
    body: payload.body || '',
    icon: payload.icon || '/dashboard/logo192.png',
    badge: payload.badge || '/dashboard/logo192.png',
    tag: payload.tag || 'dashboard-alert',
    requireInteraction: !!payload.requireInteraction,
    data: payload.data || {},
  };

  event.waitUntil(self.registration.showNotification(title, opts));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const hash = data.url_hash || '';
  // The dashboard uses HashRouter; navigate via the fragment.
  const url = '/dashboard/' + (hash ? '#' + hash : '');

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const c of clientsList) {
      if (c.url.includes('/dashboard/')) {
        await c.focus();
        // Update the route via postMessage so React Router responds without reload.
        c.postMessage({ type: 'navigate', hash });
        return;
      }
    }
    // No open tab — open one.
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});
