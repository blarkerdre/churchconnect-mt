// Shared tenant SMS / WhatsApp quota helper.
//
// Reads tenants.sms_limit_monthly / whatsapp_limit_monthly and counts rows in
// sms_log (excluding outright failures) for the current calendar month.
// A limit of 0 means "unlimited" (no enforcement).

export type SmsChannel = "sms" | "whatsapp";

export interface QuotaResult {
  allowed: boolean;
  limit: number;     // 0 == unlimited
  usage: number;
  remaining: number; // limit - usage when limit > 0; Infinity otherwise
}

export async function checkSmsQuota(
  client: any,
  tenantId: string | null | undefined,
  channel: SmsChannel,
  requested: number = 1,
): Promise<QuotaResult> {
  if (!tenantId) {
    return { allowed: true, limit: 0, usage: 0, remaining: Number.POSITIVE_INFINITY };
  }

  const limitField = channel === "whatsapp" ? "whatsapp_limit_monthly" : "sms_limit_monthly";

  const { data: tenant, error: tenantErr } = await client
    .from("tenants")
    .select(limitField)
    .eq("id", tenantId)
    .single();

  if (tenantErr) {
    // Fail open on transient errors so we never block legitimate sends due to a
    // bad lookup; warn loudly for ops.
    console.warn("[sms-quota] tenant lookup failed:", tenantErr);
    return { allowed: true, limit: 0, usage: 0, remaining: Number.POSITIVE_INFINITY };
  }

  const limit = Number(tenant?.[limitField] || 0);
  if (limit <= 0) {
    return { allowed: true, limit: 0, usage: 0, remaining: Number.POSITIVE_INFINITY };
  }

  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const { count } = await client
    .from("sms_log")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .eq("channel", channel)
    .neq("status", "failed")
    .gte("created_at", monthStart.toISOString());

  const usage = count || 0;
  const remaining = Math.max(limit - usage, 0);
  const allowed = usage + Math.max(requested, 1) <= limit;
  return { allowed, limit, usage, remaining };
}

export class QuotaExceededError extends Error {
  channel: SmsChannel;
  limit: number;
  usage: number;
  remaining: number;
  constructor(result: QuotaResult, channel: SmsChannel) {
    super(
      `${channel === "whatsapp" ? "WhatsApp" : "SMS"} quota exceeded. ` +
        `${result.remaining} messages remaining this month (limit: ${result.limit}).`,
    );
    this.name = "QuotaExceededError";
    this.channel = channel;
    this.limit = result.limit;
    this.usage = result.usage;
    this.remaining = result.remaining;
  }
}

export async function assertSmsQuota(
  client: any,
  tenantId: string | null | undefined,
  channel: SmsChannel,
  requested: number = 1,
): Promise<QuotaResult> {
  const result = await checkSmsQuota(client, tenantId, channel, requested);
  if (!result.allowed) throw new QuotaExceededError(result, channel);
  return result;
}
