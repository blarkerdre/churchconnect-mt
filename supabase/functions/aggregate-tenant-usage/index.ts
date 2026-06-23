import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Aggregates current-month usage per tenant per metric, computes overage vs the
// tenant's pricing plan, upserts tenant_usage_counters, and creates pending
// tenant_overage_charges rows for any new overage units.

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const now = new Date();
    const periodStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const periodEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0));
    const ps = periodStart.toISOString().split("T")[0];
    const pe = periodEnd.toISOString().split("T")[0];

    const { data: tenants } = await admin.from("tenants").select("id, name, pricing_plan_id");
    const { data: plans } = await admin.from("pricing_plans").select("*");
    const planMap = Object.fromEntries((plans || []).map((p: any) => [p.id, p]));

    const metrics: Array<{
      key: string;
      includedField: string;
      overagePriceField: string;
      allowField: string;
      count: (tenantId: string) => Promise<number>;
    }> = [
      {
        key: "sms",
        includedField: "included_sms",
        overagePriceField: "overage_price_sms",
        allowField: "allow_overage_sms",
        count: async (tid) => {
          const { count } = await admin.from("sms_log")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tid).gte("created_at", periodStart.toISOString());
          return count || 0;
        },
      },
      {
        key: "email",
        includedField: "included_email",
        overagePriceField: "overage_price_email",
        allowField: "allow_overage_email",
        count: async (tid) => {
          const { count } = await admin.from("email_send_log")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tid).gte("created_at", periodStart.toISOString());
          return count || 0;
        },
      },
      {
        key: "member",
        includedField: "included_members",
        overagePriceField: "overage_price_member",
        allowField: "allow_overage_member",
        count: async (tid) => {
          const { count } = await admin.from("members")
            .select("id", { count: "exact", head: true })
            .eq("tenant_id", tid);
          return count || 0;
        },
      },
    ];

    const results: any[] = [];

    for (const t of tenants || []) {
      const plan = t.pricing_plan_id ? planMap[t.pricing_plan_id] : null;
      for (const m of metrics) {
        const used = await m.count(t.id);
        const included = plan ? Number(plan[m.includedField] || 0) : 0;
        const unitPrice = plan ? Number(plan[m.overagePriceField] || 0) : 0;
        const allowOverage = plan ? Boolean(plan[m.allowField]) : false;
        const currency = plan?.currency || "GBP";

        const overageUnits = Math.max(0, used - included);
        const overageAmount = allowOverage ? overageUnits * unitPrice : 0;

        await admin.from("tenant_usage_counters").upsert(
          {
            tenant_id: t.id,
            period_start: ps,
            period_end: pe,
            metric: m.key,
            used,
            included,
            overage_units: overageUnits,
            overage_amount: overageAmount,
            currency,
          },
          { onConflict: "tenant_id,period_start,metric" },
        );

        if (overageAmount > 0) {
          // Replace pending overage charge for this period/metric (idempotent)
          await admin.from("tenant_overage_charges")
            .delete()
            .eq("tenant_id", t.id).eq("period_start", ps)
            .eq("metric", m.key).eq("status", "pending");

          await admin.from("tenant_overage_charges").insert({
            tenant_id: t.id,
            period_start: ps,
            period_end: pe,
            metric: m.key,
            quantity: overageUnits,
            unit_price: unitPrice,
            amount: overageAmount,
            currency,
            status: "pending",
          });
        }

        results.push({ tenant_id: t.id, metric: m.key, used, included, overageUnits, overageAmount });
      }
    }

    return new Response(JSON.stringify({ ok: true, period: ps, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("aggregate-tenant-usage error", err);
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
