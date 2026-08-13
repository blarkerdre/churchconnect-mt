/**
 * Shared resolution of "which church should I be in right now?".
 *
 * Priority: church in the URL → last church the user explicitly switched to →
 * the default tenant → first membership (alphabetical, so it is stable).
 *
 * The last-used church is persisted per signed-in user so switching survives
 * refreshes, bare-URL navigation and sign-in.
 */

export const DEFAULT_TENANT_ID = "d8bbbdae-d9b3-4999-912d-3aa5999884b0";

const KEY_PREFIX = "activeTenantId:";

export function getStoredTenantId(userId) {
  if (!userId) return null;
  try {
    return localStorage.getItem(KEY_PREFIX + userId) || null;
  } catch {
    return null;
  }
}

export function storeTenantId(userId, tenantId) {
  if (!userId || !tenantId) return;
  try {
    localStorage.setItem(KEY_PREFIX + userId, tenantId);
  } catch {
    /* storage unavailable — switching still works for this session */
  }
}

export function clearStoredTenantId(userId) {
  if (!userId) return;
  try {
    localStorage.removeItem(KEY_PREFIX + userId);
  } catch {
    /* ignore */
  }
}

/** Memberships sorted by church name so lists and fallbacks are deterministic. */
export function sortMemberships(memberships) {
  return [...(memberships || [])].sort((a, b) =>
    (a?.tenants?.name || "").localeCompare(b?.tenants?.name || "")
  );
}

/**
 * @param {Array} memberships rows from tenant_memberships joined with tenants
 * @param {{ slugHint?: string, userId?: string }} opts
 */
export function resolveActiveMembership(memberships, { slugHint, userId } = {}) {
  const sorted = sortMemberships(memberships);
  if (sorted.length === 0) return null;

  if (slugHint) {
    const match = sorted.find((m) => m.tenants?.slug === slugHint);
    if (match) return match;
  }

  const storedId = getStoredTenantId(userId);
  if (storedId) {
    const match = sorted.find((m) => m.tenant_id === storedId);
    if (match) return match;
  }

  if (sorted.length === 1) return sorted[0];

  return sorted.find((m) => m.tenant_id === DEFAULT_TENANT_ID) || sorted[0];
}
