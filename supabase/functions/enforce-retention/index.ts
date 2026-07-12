import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAudit } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// data_category → SQL runner (service-role, tenant-scoped)
async function runCategory(
  admin: any, tenantId: string, category: string, cutoffDays: number,
): Promise<number> {
  const cutoff = new Date(Date.now() - cutoffDays * 86400_000).toISOString();
  let deleted = 0;

  const del = async (table: string, filter: (q: any) => any) => {
    try {
      const q = filter(admin.from(table).delete().eq("tenant_id", tenantId));
      const { count, error } = await q.select("id", { count: "exact", head: true });
      if (!error && typeof count === "number") deleted += count;
    } catch (e) { console.error(`retention ${category}/${table}`, e); }
  };

  switch (category) {
    case "first_timers_unconverted":
      await del("first_timers", (q) => q.lt("created_at", cutoff).is("converted_member_id", null));
      break;
    case "pastoral_care_closed":
      await del("pastoral_care", (q) => q.lt("updated_at", cutoff).in("status", ["completed", "closed"]));
      break;
    case "call_log":
      await del("call_log", (q) => q.lt("created_at", cutoff));
      break;
    case "sms_log":
      await del("sms_log", (q) => q.lt("created_at", cutoff));
      break;
    case "email_send_log":
      await del("email_send_log", (q) => q.lt("created_at", cutoff));
      break;
    case "notifications_read":
      await del("notifications", (q) => q.lt("created_at", cutoff).eq("read", true));
      break;
    case "audit_log":
      await del("audit_log", (q) => q.lt("created_at", cutoff));
      break;
    case "purged_data_archives":
      try {
        const { count } = await admin.from("purged_data_archives").delete()
          .eq("tenant_id", tenantId).lt("created_at", cutoff)
          .select("id", { count: "exact", head: true });
        if (typeof count === "number") deleted += count;
      } catch (e) { console.error(e); }
      break;
  }
  return deleted;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Require service-role key for internal cron invocation
    const auth = req.headers.get("Authorization") || "";
    const expected = `Bearer ${serviceRoleKey}`;
    if (auth !== expected) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: policies, error } = await admin.from("retention_policies")
      .select("*").eq("enabled", true);
    if (error) throw error;

    const summary: Record<string, number> = {};
    for (const p of policies || []) {
      const days = Math.max(p.min_days, Math.min(p.max_days, p.retention_days));
      const deleted = await runCategory(admin, p.tenant_id, p.data_category, days);
      summary[`${p.tenant_id}:${p.data_category}`] = deleted;
      await admin.from("retention_policies").update({
        last_run_at: new Date().toISOString(),
        last_run_deleted_count: deleted,
      }).eq("id", p.id);
      if (deleted > 0) {
        await writeAudit(admin, {
          tenant_id: p.tenant_id, user_id: null,
          action: "retention_enforced", entity_type: "retention_policy", entity_id: p.id,
          details: { category: p.data_category, deleted, days },
        });
      }
    }

    return new Response(JSON.stringify({ success: true, summary }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("enforce-retention error:", err);
    return new Response(JSON.stringify({ error: "Retention run failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
