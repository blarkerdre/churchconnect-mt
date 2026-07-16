import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const cronSecret = Deno.env.get("CRON_ORPHAN_CLEANUP_SECRET");
    const provided = req.headers.get("x-cron-secret");
    if (!cronSecret || provided !== cronSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const CUTOFF_MS = 24 * 60 * 60 * 1000;
    const now = Date.now();

    let scanned = 0;
    let deleted = 0;
    let skipped = 0;
    const deletedUsers: { id: string; email: string | null }[] = [];
    const errors: { id: string; error: string }[] = [];

    let page = 1;
    const perPage = 200;
    while (true) {
      const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
      if (error) throw error;
      const users = data?.users || [];
      if (users.length === 0) break;

      for (const u of users) {
        scanned++;

        // Skip accounts younger than 24h
        const createdAtMs = u.created_at ? new Date(u.created_at).getTime() : now;
        if (now - createdAtMs < CUTOFF_MS) {
          skipped++;
          continue;
        }

        // Skip if the user still belongs to any tenant
        const { count: membershipCount } = await supabase
          .from("tenant_memberships")
          .select("id", { count: "exact", head: true })
          .eq("user_id", u.id);
        if ((membershipCount ?? 0) > 0) {
          skipped++;
          continue;
        }

        // Skip super_admins even if they have no tenant memberships
        const { data: isSuperAdmin } = await supabase.rpc("has_role", {
          _user_id: u.id,
          _role: "super_admin",
        });
        if (isSuperAdmin) {
          skipped++;
          continue;
        }

        // Clean up account-level rows first (defensive) and null every FK
        // column that references auth.users with ON DELETE NO ACTION. The
        // user has no tenant_memberships at this point, so we clear across
        // all tenants unconditionally.
        await supabase.from("user_roles").delete().eq("user_id", u.id);
        await supabase.from("profiles").delete().eq("user_id", u.id);
        const nullifyTargets: [string, string][] = [
          ["app_settings", "updated_by"],
          ["attendance_sessions", "created_by"],
          ["call_log", "caller_id"],
          ["events", "created_by"],
          ["first_timers", "follow_up_assigned_to"],
          ["followups", "assigned_to"],
          ["followups", "created_by"],
          ["messages", "recipient_id"],
          ["messages", "sender_id"],
          ["pastoral_care", "assigned_to"],
          ["pastoral_care", "created_by"],
          ["scheduled_communications", "created_by"],
          ["tenant_api_keys", "created_by"],
          ["transportation", "driver_user_id"],
          ["transportation", "user_id"],
          ["wsf_attendance", "recorded_by"],
          ["members", "user_id"],
        ];
        await Promise.all(
          nullifyTargets.map(([tbl, col]) =>
            supabase.from(tbl).update({ [col]: null }).eq(col, u.id),
          ),
        );

        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id);
        if (delErr) {
          errors.push({ id: u.id, error: delErr.message });
          continue;
        }
        deleted++;
        deletedUsers.push({ id: u.id, email: u.email ?? null });
      }

      if (users.length < perPage) break;
      page++;
    }

    // Audit summary (tenant_id null = platform-wide)
    if (deleted > 0 || errors.length > 0) {
      await supabase.from("audit_log").insert({
        tenant_id: null,
        user_id: null,
        action: "orphan_auth_cleanup",
        entity_type: "auth.users",
        entity_id: null,
        details: { scanned, deleted, skipped, deleted_users: deletedUsers, errors },
      });
    }

    return new Response(
      JSON.stringify({ scanned, deleted, skipped, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("cleanup-orphan-auth-users error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "unexpected error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
