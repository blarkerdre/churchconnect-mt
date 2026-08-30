import { lazy } from "react";

/**
 * React.lazy with resilience against stale chunk hashes after a new deploy.
 * Retries the dynamic import once (cache-busted); if it still fails, clears
 * caches/service workers and hard-reloads the page a single time.
 */
const RELOAD_KEY = "__chunk_reload_attempted__";

async function hardReload() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return;
    sessionStorage.setItem(RELOAD_KEY, "1");
  } catch {}
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
  } catch {}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {}
  const url = new URL(window.location.href);
  url.searchParams.set("_r", Date.now().toString());
  window.location.replace(url.toString());
}

export function lazyRetry(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // One quiet retry — covers transient network/CDN blips.
      try {
        return await factory();
      } catch {
        await hardReload();
        // Keep the Suspense boundary pending while the page reloads.
        return await new Promise(() => {});
      }
    }
  });
}
