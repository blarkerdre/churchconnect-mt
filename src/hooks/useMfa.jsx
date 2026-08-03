import { supabase } from "@/integrations/supabase/client";

/**
 * Shared TOTP (authenticator app) helpers.
 *
 * Session flag: once a browser session has satisfied the MFA challenge we
 * remember it. This matters because destructive-action confirmation
 * (PasswordConfirmDialog) re-runs signInWithPassword, which mints a fresh
 * aal1 session — without the flag the user would be re-challenged mid-flow.
 */
const PASSED_KEY = "mfa_passed";

export function markMfaPassed() {
  try { sessionStorage.setItem(PASSED_KEY, "1"); } catch { /* ignore */ }
}

export function hasMfaPassed() {
  try { return sessionStorage.getItem(PASSED_KEY) === "1"; } catch { return false; }
}

export function clearMfaPassed() {
  try { sessionStorage.removeItem(PASSED_KEY); } catch { /* ignore */ }
}

export async function listTotpFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const all = data?.all || [];
  return {
    verified: all.filter((f) => f.factor_type === "totp" && f.status === "verified"),
    unverified: all.filter((f) => f.factor_type === "totp" && f.status !== "verified"),
  };
}

/** Removes any half-finished enrolments so a retry never hits "factor already exists". */
export async function cleanupUnverifiedFactors() {
  try {
    const { unverified } = await listTotpFactors();
    for (const f of unverified) {
      await supabase.auth.mfa.unenroll({ factorId: f.id });
    }
  } catch { /* best effort */ }
}

export async function startTotpEnrolment() {
  await cleanupUnverifiedFactors();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: `Authenticator ${new Date().toISOString().slice(0, 10)}`,
  });
  if (error) throw error;
  return { factorId: data.id, qr: data.totp?.qr_code, secret: data.totp?.secret };
}

export async function verifyTotp(factorId, code) {
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code: String(code || "").trim(),
  });
  if (error) throw error;
  markMfaPassed();
  return true;
}

export async function unenrolFactor(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

/**
 * True when the signed-in user has a verified authenticator but the current
 * session has not been elevated to aal2 yet.
 */
export async function isMfaChallengeRequired() {
  if (hasMfaPassed()) return false;
  try {
    const { data, error } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return false;
    return data?.currentLevel === "aal1" && data?.nextLevel === "aal2";
  } catch {
    return false;
  }
}
