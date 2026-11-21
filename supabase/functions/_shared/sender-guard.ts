// Shared checks for functions that send caller-written messages (SMS,
// WhatsApp, email). They run with elevated database access, so they must
// re-apply the same two-step verification gate the database enforces and
// strip anything that is not plain message text.
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Returns true when the caller's session satisfies the church's two-step
 * verification rule (aal2 when the user has a verified authenticator).
 */
export async function callerMfaSatisfied(
  supabaseUrl: string,
  anonKey: string,
  authHeader: string,
): Promise<boolean> {
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data, error } = await userClient.rpc("mfa_satisfied");
  if (error) {
    console.error("[sender-guard] mfa check failed", error.message);
    return false;
  }
  return data === true;
}

/** Remove control characters (optionally keeping newlines) and HTML tags. */
export function cleanMessageText(v: unknown, keepNewlines = true): string {
  const s = String(v ?? "");
  const ctrl = keepNewlines ? /[\u0000-\u0009\u000B-\u001F\u007F]/g : /[\u0000-\u001F\u007F]/g;
  return s.replace(ctrl, "").replace(/<[^>]*>/g, "").trim();
}

/** Last-9-digit key used to compare phone numbers across formats. */
export function phoneKey(p: unknown): string {
  return String(p ?? "").replace(/\D/g, "").slice(-9);
}

/** Lower-cased unit names a user leads in this tenant. */
// deno-lint-ignore no-explicit-any
export async function loadLeaderUnits(serviceClient: any, userId: string, tenantId: string): Promise<string[]> {
  const { data } = await serviceClient
    .from("unit_leader_assignments")
    .select("unit_name")
    .eq("user_id", userId)
    .eq("tenant_id", tenantId);
  return (data || [])
    .map((a: { unit_name: string }) => String(a.unit_name || "").trim().toLowerCase())
    .filter(Boolean);
}

/** True when a member's comma-separated unit list includes one of the units. */
export function memberInUnits(churchUnit: unknown, units: string[]): boolean {
  return String(churchUnit || "")
    .toLowerCase()
    .split(",")
    .map((u) => u.trim())
    .some((u) => units.includes(u));
}

const LINK_RE = /\b(?:https?:\/\/|www\.)\S+|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|net|org|co|uk|io|me|info|biz|xyz|link|ly|app|site|online|top|click|ng|ca|us)\b(?:\/\S*)?/gi;
const SHORTENERS = /\b(?:bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|buff\.ly|rebrand\.ly|cutt\.ly|shorturl\.at|rb\.gy|tiny\.cc|t\.ly|s\.id)\b/i;
const IP_LINK = /\b(?:https?:\/\/)?\d{1,3}(?:\.\d{1,3}){3}(?::\d+)?\b/;
const CREDENTIAL_BAIT = /\b(?:send|reply(?: with)?|share|text|give|tell|confirm|enter|provide|forward)\b[^.!?\n]{0,30}\b(?:your|ur)\s+(?:password|passcode|pin|verification code|security code|one[- ]time code|otp|login code|bank details|account number|card number|card details|sort code|cvv)\b/i;

/**
 * Bounds what a church sender may put in a text. Returns a user-facing reason
 * when the message is not allowed, otherwise null.
 * - Only church admins may include web links; unit leaders and follow-up
 *   workers send plain text only.
 * - Nobody may send hidden-destination links (URL shorteners) or links to raw
 *   IP addresses, which are typical of phishing.
 * - Nobody may ask recipients to send passwords, codes or bank/card details.
 */
export function smsContentProblem(message: string, senderIsAdmin: boolean): string | null {
  if (CREDENTIAL_BAIT.test(message)) {
    return "Texts can't ask people for passwords, codes, PINs or bank/card details.";
  }
  if (SHORTENERS.test(message) || IP_LINK.test(message)) {
    return "Shortened links and links to number-only addresses aren't allowed in texts. Use the full web address.";
  }
  LINK_RE.lastIndex = 0;
  if (!senderIsAdmin && LINK_RE.test(message)) {
    return "Only church admins can include web links in texts.";
  }
  return null;
}
