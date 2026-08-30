import { lazy } from "react";

/**
 * React.lazy with resilience against stale chunk hashes after a new deploy.
 * Retries the dynamic import once (cache-busted); if it still fails, clears
 * caches/service workers and hard-reloads the page a single time.
 * If a reload was already attempted in this tab, the error is rethrown so an
 * error boundary can show a recovery UI instead of an endless spinner.
 */
const RELOAD_KEY = "__chunk_reload_attempted__";

function clearReloadFlag() {
  try {
    sessionStorage.removeItem(RELOAD_KEY);
  } catch {}
}

async function hardReload() {
  try {
    if (sessionStorage.getItem(RELOAD_KEY)) return false;
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
  return true;
}

export function lazyRetry(factory) {
  return lazy(async () => {
    try {
      const mod = await factory();
      clearReloadFlag();
      return mod;
    } catch (err) {
      // One quiet retry — covers transient network/CDN blips.
      try {
        const mod = await factory();
        clearReloadFlag();
        return mod;
      } catch (err2) {
        const reloading = await hardReload();
        if (!reloading) {
          // Already reloaded once in this tab — surface the error so an error
          // boundary renders instead of hanging on the Suspense fallback.
          throw err2;
        }
        // Keep the Suspense boundary pending while the page reloads.
        return await new Promise(() => {});
      }
    }
  });
}
