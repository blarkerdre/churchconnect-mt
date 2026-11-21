// Notification service worker: shows phone/desktop notifications for web push.
// It does NOT cache the app (keeps clearing legacy app-shell caches).
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
        const names = await caches.keys();
        await Promise.allSettled(names.filter(isLegacyAppCache).map((n) => caches.delete(n)));
      } catch { /* ignore */ }
      await self.clients.claim();
    })(),
  ),
);

self.addEventListener("push", (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { message: event.data && event.data.text() }; }
  const title = data.title || "New notification";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.message || "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || undefined,
      renotify: !!data.tag,
      vibrate: [300, 150, 300],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const wins = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const w of wins) {
        if (w.url.startsWith(self.location.origin)) {
          try { await w.focus(); return w.navigate(target); } catch { /* fallthrough */ }
        }
      }
      return self.clients.openWindow(target);
    })(),
  );
});
