// Picks the Twilio SMS "From" number for a church and destination.
// +1 (Canada/US) destinations use the church's North American number when set,
// because UK numbers cannot text +1 numbers.
const cache = new Map<string, Record<string, unknown>>();

export function pickSmsFromSettings(settings: Record<string, unknown> | null | undefined, to: string, fallback: string): string {
  const clean = (v: unknown) => (typeof v === "string" ? v.replace(/[\s\-().]/g, "") : "");
  const s = settings || {};
  const na = clean(s.twilio_sms_from_na);
  if (to.startsWith("+1") && /^\+1\d{10}$/.test(na)) return na;
  const own = clean(s.twilio_sms_from);
  if (/^\+[1-9]\d{6,14}$/.test(own)) return own;
  return fallback;
}

// deno-lint-ignore no-explicit-any
export async function resolveSmsFrom(client: any, tenantId: string | null | undefined, to: string, fallback: string): Promise<string> {
  if (!tenantId) return fallback;
  let settings = cache.get(tenantId);
  if (!settings) {
    const { data } = await client.from("tenants").select("settings").eq("id", tenantId).maybeSingle();
    settings = (data?.settings as Record<string, unknown>) || {};
    cache.set(tenantId, settings);
  }
  return pickSmsFromSettings(settings, to, fallback);
}
