import { lazy } from "react";

/**
 * React.lazy with resilience against stale chunk hashes after a new deploy.
 * Retries the dynamic import once (cache-busted); if it still fails, clears
 * caches/service workers and hard-reloads the page — but at most once per
 * cooldown window, so a permanently broken chunk cannot trap the user in an
 * endless reload loop. When the cooldown is active, the error is rethrown so
 * an error boundary can show a recovery UI.
 */
export const RELOAD_KEY = "__chunk_reload_attempted_at__";
const RELOAD_COOLDOWN_MS = 60_000;

function reloadRecently() {
  try {
    const ts = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
    return ts > 0 && Date.now() - ts < RELOAD_COOLDOWN_MS;
  } catch {
    return false;
  }
}

export async function hardReload() {
  // Time-based guard: never clear on success, so a persistently failing chunk
  // reloads at most once per cooldown window.
  if (reloadRecently()) return false;
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
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
  return true;
}

export function lazyRetry(factory) {
  return lazy(async () => {
    try {
      return await factory();
    } catch (err) {
      // One quiet retry — covers transient network/CDN blips.
      try {
        return await factory();
      } catch (err2) {
        const reloading = await hardReload();
        if (!reloading) {
          // Reloaded recently already — surface the error so an error boundary
          // renders instead of hanging on the Suspense fallback.
          throw err2;
        }
        // Keep the Suspense boundary pending while the page reloads.
        return await new Promise(() => {});
      }
    }
  });
}
