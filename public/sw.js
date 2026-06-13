// Temporary app-shell service worker kill switch.
// It replaces the previous /sw.js so returning browsers discard stale cached
// React chunks, then unregisters itself.
function isLegacyAppCache(name) {
  return (
    /^html-v\d+$/.test(name) ||
    /^assets-v\d+$/.test(name) ||
    ((/(^|-)precache-v\d+-|(^|-)runtime-|(^|-)googleAnalytics-/).test(name) &&
      name.endsWith(self.registration.scope))
  );
}

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (event) =>
  event.waitUntil(
    (async () => {
      try {
        const cacheNames = await caches.keys();
        const appCacheNames = cacheNames.filter(isLegacyAppCache);
        await Promise.allSettled(appCacheNames.map((name) => caches.delete(name)));
        await self.clients.claim();
        const windowClients = await self.clients.matchAll({ type: "window" });
        await Promise.allSettled(windowClients.map((client) => client.navigate(client.url)));
      } finally {
        await self.registration.unregister();
      }
    })(),
  ),
);
