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

// Decide how a send is covered once the monthly quota is used up.
// Order: monthly quota -> bought top-up texts -> billed extras (if plan allows) -> block.
export function planSmsCoverage(opts: { limit: number; usage: number; requested: number; credits: number; allowOverage: boolean }) {
  const req = Math.max(opts.requested, 1);
  const freeLeft = Math.max(opts.limit - opts.usage, 0);
  const beyond = Math.max(req - freeLeft, 0);
  const fromCredits = Math.min(beyond, Math.max(opts.credits, 0));
  const overage = beyond - fromCredits;
  return { allowed: overage === 0 || opts.allowOverage, fromCredits, overage };
}

// Price per text: the church's own price if set, otherwise the plan's price.
export function resolveSmsUnitPrice(override: unknown, planPrice: unknown): number {
  if (override !== null && override !== undefined && override !== "" && Number.isFinite(Number(override)) && Number(override) >= 0) return Number(override);
  return Number(planPrice || 0);
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
    .select(`${limitField}, sms_credit_balance, pricing_plan_id`)
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
  if (usage + Math.max(requested, 1) <= limit || channel !== "sms") {
    return { allowed: usage + Math.max(requested, 1) <= limit, limit, usage, remaining };
  }
  let allowOverage = false;
  if (tenant?.pricing_plan_id) {
    const { data: plan } = await client.from("pricing_plans").select("allow_overage_sms").eq("id", tenant.pricing_plan_id).maybeSingle();
    allowOverage = Boolean(plan?.allow_overage_sms);
  }
  const cov = planSmsCoverage({ limit, usage, requested, credits: Number(tenant?.sms_credit_balance || 0), allowOverage });
  if (!cov.allowed) return { allowed: false, limit, usage, remaining };
  if (cov.fromCredits > 0) {
    const { error } = await client.rpc("consume_sms_credits", { _tenant_id: tenantId, _n: cov.fromCredits });
    if (error) console.warn("[sms-quota] consume credits failed:", error);
  }
  return { allowed: true, limit, usage, remaining };
}

export class QuotaExceededError extends Error {
  channel: SmsChannel;
  limit: number;
  usage: number;
  remaining: number;
  constructor(result: QuotaResult, channel: SmsChannel) {
    super(
      channel === "whatsapp"
        ? `WhatsApp quota exceeded. ${result.remaining} messages remaining this month (limit: ${result.limit}).`
        : `Your monthly texts are used up (${result.remaining} left of ${result.limit}). Buy more texts in Billing.`,
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
