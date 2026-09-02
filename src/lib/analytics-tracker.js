/**
 * First-party, privacy-friendly page-view tracking.
 * No IP addresses are stored server-side; the visitor id is a random,
 * rotating anonymous value that carries no personal data.
 */

const VISITOR_KEY = "cc_visitor_id";
const VISITOR_TS_KEY = "cc_visitor_id_ts";
const SESSION_KEY = "cc_session_id";
const SESSION_TS_KEY = "cc_session_ts";

const VISITOR_TTL_MS = 30 * 24 * 60 * 60 * 1000; // rotate the anonymous id monthly
const SESSION_IDLE_MS = 30 * 60 * 1000; // a visit ends after 30 minutes idle

function randomId() {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
}

function safeGet(store, key) {
  try {
    return store.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(store, key, value) {
  try {
    store.setItem(key, value);
  } catch {
    /* storage unavailable (private mode) — tracking silently degrades */
  }
}

function getVisitorId() {
  const now = Date.now();
  const id = safeGet(localStorage, VISITOR_KEY);
  const ts = Number(safeGet(localStorage, VISITOR_TS_KEY) || 0);
  if (id && now - ts < VISITOR_TTL_MS) return id;
  const fresh = randomId();
  safeSet(localStorage, VISITOR_KEY, fresh);
  safeSet(localStorage, VISITOR_TS_KEY, String(now));
  return fresh;
}

function getSessionId() {
  const now = Date.now();
  const id = safeGet(sessionStorage, SESSION_KEY);
  const ts = Number(safeGet(sessionStorage, SESSION_TS_KEY) || 0);
  const fresh = id && now - ts < SESSION_IDLE_MS ? id : randomId();
  safeSet(sessionStorage, SESSION_KEY, fresh);
  safeSet(sessionStorage, SESSION_TS_KEY, String(now));
  return fresh;
}

function tenantSlugFromPath(pathname) {
  const m = pathname.match(/^\/t\/([^/]+)/);
  return m ? m[1] : null;
}

/** Strips ids/tokens out of the path so analytics stays anonymous and groupable. */
export function normalisePath(pathname) {
  return pathname
    .replace(/^\/t\/[^/]+/, "/t/:tenant")
    .replace(/\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, "/:id")
    .replace(/\/[A-Za-z0-9_-]{20,}/g, "/:token")
    .slice(0, 300);
}

let lastKey = "";

export function trackPageView({ isAuthenticated = false } = {}) {
  if (typeof window === "undefined") return;
  if (navigator.doNotTrack === "1" || window.doNotTrack === "1") return;
  // Skip local development hosts only — preview and production are tracked
  if (/^(localhost|127\.|\[?::1)/.test(window.location.hostname)) return;

  const { pathname, search } = window.location;
  const path = normalisePath(pathname);
  const sessionId = getSessionId();
  const key = `${sessionId}|${path}${search}`;
  if (key === lastKey) return; // ignore duplicate fires for the same view
  lastKey = key;

  const payload = {
    path,
    referrer: document.referrer ? document.referrer.slice(0, 300) : null,
    visitor_id: getVisitorId(),
    session_id: sessionId,
    tenant_slug: tenantSlugFromPath(pathname),
    is_authenticated: isAuthenticated,
  };

  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/track-pageview`;
  const body = JSON.stringify(payload);
  // text/plain keeps this a "simple" CORS request, so the browser sends it
  // immediately with no preflight (which sendBeacon cannot recover from).
  const blob = new Blob([body], { type: "text/plain;charset=UTF-8" });

  try {
    if (navigator.sendBeacon && navigator.sendBeacon(url, blob)) return;
  } catch {
    /* fall through to fetch */
  }

  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain;charset=UTF-8",
      ...(anonKey ? { apikey: anonKey, Authorization: `Bearer ${anonKey}` } : {}),
    },
    body,
    keepalive: true,
  }).catch(() => {});
}
