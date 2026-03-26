/**
 * Environment detection utilities.
 * Helps distinguish Test (preview) vs Live (published) at runtime.
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID || "";

/** True when the app is running on a preview / test URL */
export function isPreviewEnvironment() {
  const host = window.location.hostname;
  return (
    host.includes("lovableproject.com") ||
    (host.includes("lovable.app") && host.includes("preview")) ||
    host === "localhost" ||
    host === "127.0.0.1"
  );
}

/**
 * Returns "Preview" or "Published" based on hostname.
 * Both environments share the same database — this label only
 * indicates which deployment the user is viewing, NOT data isolation.
 */
export function getEnvironmentLabel() {
  return isPreviewEnvironment() ? "Preview" : "Published";
}

/** Returns a short identifier for the connected backend */
export function getBackendHost() {
  try {
    return new URL(SUPABASE_URL).hostname;
  } catch {
    return SUPABASE_URL || "unknown";
  }
}

/** Checks if the backend URL matches the expected project */
export function isBackendMismatch() {
  if (!SUPABASE_URL || !PROJECT_ID) return false;
  return !SUPABASE_URL.includes(PROJECT_ID);
}
