/* eslint-disable no-undef */
// Build-time constants injected via vite `define` (see vite.config.js).
// Fallbacks keep dev safe if the defines are missing.

export const BUILD_TIME =
  typeof __BUILD_TIME__ !== "undefined" ? __BUILD_TIME__ : new Date().toISOString();

export const BUILD_ID =
  typeof __BUILD_ID__ !== "undefined" ? __BUILD_ID__ : "dev";

/** Human-readable short build stamp, e.g. "17 Jul 26 · 21:29" */
export function formatBuildStamp() {
  try {
    const d = new Date(BUILD_TIME);
    if (Number.isNaN(d.getTime())) return BUILD_ID;
    const date = d.toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "2-digit",
    });
    const time = d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
    return `${date} · ${time}`;
  } catch {
    return BUILD_ID;
  }
}

/**
 * Aggressively clear all client-side caches and reload the page.
 * Use this when a user reports "changes not showing up in live" after a publish.
 *
 * - Unregisters every service worker registration for this origin.
 * - Deletes all Cache Storage buckets.
 * - Reloads with a cache-bust query param so the HTML is refetched fresh.
 */
export async function forceRefresh() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.allSettled(regs.map((r) => r.unregister()));
    }
  } catch {
    /* ignore */
  }
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* ignore */
  }
  try {
    const url = new URL(window.location.href);
    url.searchParams.set("_r", Date.now().toString());
    window.location.replace(url.toString());
  } catch {
    window.location.reload();
  }
}
