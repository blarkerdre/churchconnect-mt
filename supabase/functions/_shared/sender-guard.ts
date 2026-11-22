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
// Classic scam asks: untraceable payment methods and "verify your account" lures.
const SCAM_BAIT = /\b(?:gift ?cards?|itunes cards?|steam cards?|google play cards?|amazon cards?|bitcoin|usdt|crypto ?currenc(?:y|ies)|crypto wallet|western union|moneygram)\b|\b(?:verify|confirm|unlock|reactivate)\s+(?:your|ur)\s+(?:account|identity|login|log-in|bank)\b|\b(?:your|ur)\s+account\s+(?:has been|is|was)\s+(?:suspended|locked|blocked|compromised|deactivated)\b/i;
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
  return messageContentProblem(message, senderIsAdmin, "texts");
}

/** Same rules as smsContentProblem, worded for the kind of message ("texts", "emails"). */
export function messageContentProblem(message: string, senderIsAdmin: boolean, kind: "texts" | "emails" = "texts"): string | null {
  const Kind = kind.charAt(0).toUpperCase() + kind.slice(1);
  if (CREDENTIAL_BAIT.test(message)) {
    return `${Kind} can't ask people for passwords, codes, PINs or bank/card details.`;
  }
  if (SCAM_BAIT.test(message)) {
    return `${Kind} can't ask for gift cards, crypto or money-transfer services, or ask people to "verify" or unlock an account.`;
  }
  if (SHORTENERS.test(message) || IP_LINK.test(message)) {
    return `Shortened links and links to number-only addresses aren't allowed in ${kind}. Use the full web address.`;
  }
  LINK_RE.lastIndex = 0;
  if (!senderIsAdmin && LINK_RE.test(message)) {
    return `Only church admins can include web links in ${kind}.`;
  }
  return null;
}

/** True when the church's account is suspended for billing. */
// deno-lint-ignore no-explicit-any
export async function tenantSuspended(serviceClient: any, tenantId: string): Promise<boolean> {
  const { data, error } = await serviceClient
    .from("tenants")
    .select("subscription_status")
    .eq("id", tenantId)
    .maybeSingle();
  if (error) {
    console.error("[sender-guard] suspension check failed", error.message);
    return true; // fail closed
  }
  return String(data?.subscription_status || "").toLowerCase() === "suspended";
}

/** True when a feature (e.g. "/sms", "/phone-call", "/whatsapp") is switched off for the church. */
export function featureOffIn(settings: any, path: string): boolean {
  const list = settings?.disabled_features;
  return Array.isArray(list) && list.includes(path);
}

/** Looks up the church and says whether the feature is switched off (fails closed). */
// deno-lint-ignore no-explicit-any
export async function featureDisabled(serviceClient: any, tenantId: string, path: string): Promise<boolean> {
  const { data, error } = await serviceClient.from("tenants").select("settings").eq("id", tenantId).maybeSingle();
  if (error) { console.error("[sender-guard] feature check failed", error.message); return true; }
  return featureOffIn(data?.settings, path);
}

export const SUSPENDED_MESSAGE = "This church's account is suspended. Messages can't be sent until billing is sorted out.";

/** How many texts a non-admin may send in 24 hours (on top of the church's own limit). */
export const NON_ADMIN_DAILY_SMS_LIMIT = 200;

/** Texts this person sent for this church in the last 24 hours. */
// deno-lint-ignore no-explicit-any
export async function smsSentBySenderLastDay(serviceClient: any, senderId: string, tenantId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await serviceClient
    .from("sms_log")
    .select("id", { count: "exact", head: true })
    .eq("sender_id", senderId)
    .eq("tenant_id", tenantId)
    .neq("status", "failed")
    .gte("created_at", since);
  if (error) {
    console.error("[sender-guard] sender count failed", error.message);
    return Number.MAX_SAFE_INTEGER; // fail closed
  }
  return count || 0;
}

/**
 * For texts a person wrote earlier and the system sends later (scheduled texts,
 * scheduled follow-up texts): apply the same content rules as a live send,
 * judged by the author's role. Returns a reason when it must not be sent.
 */
// deno-lint-ignore no-explicit-any
export async function scheduledSmsContentProblem(serviceClient: any, message: string, authorId: string | null, tenantId: string, kind: "texts" | "emails" = "texts"): Promise<string | null> {
  const authorIsAdmin = await authorIsChurchAdmin(serviceClient, authorId, tenantId);
  return messageContentProblem(message, authorIsAdmin, kind);
}

/** True when the author is an admin of this church or a platform super-admin. */
// deno-lint-ignore no-explicit-any
export async function authorIsChurchAdmin(serviceClient: any, authorId: string | null, tenantId: string): Promise<boolean> {
  if (!authorId) return false;
  const [{ data: a }, { data: s }] = await Promise.all([
    serviceClient.rpc("is_admin", { _user_id: authorId, _tenant_id: tenantId }),
    serviceClient.rpc("has_role", { _user_id: authorId, _role: "super_admin" }),
  ]);
  return a === true || s === true;
}

/** Follow-up texts already sent about one follow-up in the last 24 hours. */
export const FOLLOWUP_DAILY_SMS_LIMIT = 3;
// deno-lint-ignore no-explicit-any
export async function followupSmsLastDay(serviceClient: any, followupId: string, tenantId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await serviceClient
    .from("sms_log")
    .select("id", { count: "exact", head: true })
    .eq("reference_id", followupId)
    .eq("tenant_id", tenantId)
    .eq("sms_type", "followup")
    .neq("status", "failed")
    .gte("created_at", since);
  if (error) {
    console.error("[sender-guard] follow-up count failed", error.message);
    return Number.MAX_SAFE_INTEGER; // fail closed
  }
  return count || 0;
}

/** How many phone calls a non-admin may place in 24 hours. */
export const NON_ADMIN_DAILY_CALL_LIMIT = 50;

/** Calls this person placed for this church in the last 24 hours. */
// deno-lint-ignore no-explicit-any
export async function callsByCallerLastDay(serviceClient: any, callerId: string, tenantId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await serviceClient
    .from("call_log")
    .select("id", { count: "exact", head: true })
    .eq("caller_id", callerId)
    .eq("tenant_id", tenantId)
    .gte("created_at", since);
  if (error) {
    console.error("[sender-guard] call count failed", error.message);
    return Number.MAX_SAFE_INTEGER; // fail closed
  }
  return count || 0;
}

/** Hex SHA-256 of a message, used to spot the same message being sent again. */
export async function messageHash(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Phone numbers (as stored in sms_log) that already received exactly this
 * message from this church in the last 24 hours. Used to stop the same text
 * being blasted at people over and over.
 */
// deno-lint-ignore no-explicit-any
export async function phonesAlreadySentMessage(serviceClient: any, tenantId: string, message: string, phones: string[]): Promise<Set<string>> {
  const out = new Set<string>();
  const unique = Array.from(new Set(phones.filter(Boolean)));
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  for (let i = 0; i < unique.length; i += 150) {
    const chunk = unique.slice(i, i + 150);
    const { data, error } = await serviceClient
      .from("sms_log")
      .select("recipient_phone, message")
      .eq("tenant_id", tenantId)
      .in("recipient_phone", chunk)
      .neq("status", "failed")
      .gte("created_at", since)
      .limit(5000);
    if (error) {
      console.error("[sender-guard] repeat check failed", error.message);
      continue;
    }
    for (const r of data || []) {
      if (r.message === message) out.add(r.recipient_phone);
    }
  }
  return out;
}

/** How many people a non-admin may email in 24 hours. */
export const NON_ADMIN_DAILY_EMAIL_LIMIT = 300;

/**
 * Church emails this person sent in the last 24 hours: total recipients and
 * whether this exact message (by hash) was already sent.
 */
// deno-lint-ignore no-explicit-any
export async function emailSendsLastDay(serviceClient: any, senderId: string, tenantId: string, hash: string): Promise<{ recipients: number; repeat: boolean }> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await serviceClient
    .from("audit_log")
    .select("details")
    .eq("tenant_id", tenantId)
    .eq("user_id", senderId)
    .eq("action", "email_sent")
    .gte("created_at", since)
    .limit(1000);
  if (error) {
    console.error("[sender-guard] email count failed", error.message);
    return { recipients: Number.MAX_SAFE_INTEGER, repeat: false }; // fail closed
  }
  let recipients = 0;
  let repeat = false;
  // deno-lint-ignore no-explicit-any
  for (const r of (data || []) as any[]) {
    const d = r.details || {};
    if (d.source !== "send-email-alert") continue;
    recipients += Number(d.success_count ?? d.recipients_count ?? 0) || 0;
    if (d.message_hash === hash) repeat = true;
  }
  return { recipients, repeat };
}
