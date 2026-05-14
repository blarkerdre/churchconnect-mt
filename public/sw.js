/* Auto-updating service worker
 * - skipWaiting + clients.claim so new versions activate immediately
 * - NetworkFirst for HTML navigations (never lock to a stale shell)
 * - StaleWhileRevalidate for static assets (JS/CSS/images)
 * - Push notification handlers preserved
 */

const VERSION = 'v3';
const HTML_CACHE = `html-${VERSION}`;
const ASSET_CACHE = `assets-${VERSION}`;

self.addEventListener('install', (event) => {
  // Activate this worker as soon as it finishes installing
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Clean up old caches from previous versions
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((n) => n !== HTML_CACHE && n !== ASSET_CACHE)
          .map((n) => caches.delete(n))
      );
      // Take control of all open clients immediately
      await self.clients.claim();
    })()
  );
});

// Allow the page to trigger an immediate activation if needed
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip cross-origin, Supabase API calls, and anything non-http(s)
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // HTML navigations -> NetworkFirst (3s timeout, fall back to cache, then offline shell)
  const isNavigation =
    req.mode === 'navigate' ||
    (req.headers.get('accept') || '').includes('text/html');

  if (isNavigation) {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetchWithTimeout(req, 3000);
          const cache = await caches.open(HTML_CACHE);
          cache.put(req, fresh.clone()).catch(() => {});
          return fresh;
        } catch {
          const cache = await caches.open(HTML_CACHE);
          const cached = await cache.match(req);
          return cached || (await cache.match('/')) || Response.error();
        }
      })()
    );
    return;
  }

  // Static assets -> StaleWhileRevalidate
  if (/\.(?:js|css|woff2?|ttf|otf|png|jpg|jpeg|gif|svg|webp|ico)$/i.test(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(ASSET_CACHE);
        const cached = await cache.match(req);
        const network = fetch(req)
          .then((res) => {
            if (res && res.status === 200) cache.put(req, res.clone()).catch(() => {});
            return res;
          })
          .catch(() => null);
        return cached || (await network) || Response.error();
      })()
    );
  }
});

function fetchWithTimeout(request, ms) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    fetch(request).then(
      (res) => { clearTimeout(timer); resolve(res); },
      (err) => { clearTimeout(timer); reject(err); }
    );
  });
}

/* ---------- Push notifications (unchanged) ---------- */

self.addEventListener('push', (event) => {
  const data = event.data?.json?.() ?? {};
  const title = data.title || 'New Notification';
  const options = {
    body: data.message || data.body || '',
    icon: '/icon-192.png',
    badge: '/favicon.ico',
    vibrate: [200, 100, 200],
    tag: data.tag || 'pwa-notification',
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});
