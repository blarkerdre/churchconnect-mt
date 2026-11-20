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
