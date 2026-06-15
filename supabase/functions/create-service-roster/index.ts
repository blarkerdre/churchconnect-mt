import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const anon = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await anon.auth.getUser();
    if (userErr || !user) return json({ error: "Invalid session" }, 401);

    const body = await req.json().catch(() => ({}));
    const {
      tenant_id,
      unit_name,
      service_type,
      service_date,
      title,
      assignments,
    } = body || {};

    if (!tenant_id) return json({ error: "tenant_id is required" }, 400);
    if (!unit_name || typeof unit_name !== "string") return json({ error: "unit_name is required" }, 400);
    if (!service_type || typeof service_type !== "string") return json({ error: "service_type is required" }, 400);
    if (!service_date || typeof service_date !== "string") return json({ error: "service_date is required" }, 400);
    if (!Array.isArray(assignments) || assignments.length === 0) {
      return json({ error: "At least one assignment is required" }, 400);
    }
    for (const a of assignments) {
      if (!a?.member_id || !a?.title || !String(a.title).trim()) {
        return json({ error: "Each assignment needs member_id and title" }, 400);
      }
    }

    // Permission check
    const [{ data: isSuper }, { data: isAdminFlag }, { data: leadsUnit }] = await Promise.all([
      admin.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
      admin.rpc("is_admin", { _user_id: user.id, _tenant_id: tenant_id }),
      admin.rpc("user_leads_unit", { _user_id: user.id, _unit_name: unit_name, _tenant_id: tenant_id }),
    ]);
    if (!isSuper && !isAdminFlag && !leadsUnit) {
      return json({ error: "You don't have permission to create rosters for this unit." }, 403);
    }

    // Validate service type against settings
    const { data: setting } = await admin
      .from("app_settings")
      .select("value")
      .eq("tenant_id", tenant_id)
      .eq("key", "service_types")
      .maybeSingle();
    const allowed: string[] = Array.isArray(setting?.value) ? (setting!.value as string[]) : [];
    if (allowed.length > 0 && !allowed.includes(service_type)) {
      return json({ error: `Unknown service type. Configure it in Settings → Services.` }, 400);
    }

    // Resolve members within tenant
    const memberIds = [...new Set(assignments.map((a: any) => a.member_id))];
    const { data: members, error: mErr } = await admin
      .from("members")
      .select("id, user_id, tenant_id")
      .eq("tenant_id", tenant_id)
      .in("id", memberIds);
    if (mErr) return json({ error: "Failed to resolve members" }, 500);
    const memberById = new Map((members || []).map((m: any) => [m.id, m]));
    for (const a of assignments) {
      if (!memberById.has(a.member_id)) {
        return json({ error: "One or more members are not in this tenant" }, 400);
      }
    }

    // Create group
    const { data: group, error: gErr } = await admin
      .from("unit_task_groups")
      .insert({
        tenant_id,
        unit_name,
        service_type,
        service_date,
        title: title?.trim() || null,
        created_by: user.id,
      })
      .select()
      .single();
    if (gErr || !group) {
      console.error("[create-service-roster] group insert failed", gErr);
      return json({ error: gErr?.message || "Failed to create roster" }, 500);
    }

    // Create one task + one assignment per row
    const taskIds: string[] = [];
    for (const a of assignments) {
      const m: any = memberById.get(a.member_id);
      const { data: task, error: tErr } = await admin
        .from("unit_tasks")
        .insert({
          tenant_id,
          unit_name,
          title: String(a.title).trim(),
          description: a.description ? String(a.description).trim() : null,
          due_date: a.due_date || null,
          priority: a.priority || "Medium",
          status: "Open",
          created_by: user.id,
          group_id: group.id,
          service_type,
          service_date,
        })
        .select("id")
        .single();
      if (tErr || !task) {
        console.error("[create-service-roster] task insert failed", tErr);
        // rollback group (cascades tasks)
        await admin.from("unit_task_groups").delete().eq("id", group.id);
        return json({ error: tErr?.message || "Failed to create roster tasks" }, 500);
      }
      taskIds.push(task.id);

      const { error: aErr } = await admin.from("unit_task_assignments").insert({
        tenant_id,
        task_id: task.id,
        member_id: m.id,
        user_id: m.user_id || null,
        status: "Pending",
      });
      if (aErr) {
        console.error("[create-service-roster] assignment insert failed", aErr);
        await admin.from("unit_task_groups").delete().eq("id", group.id);
        return json({ error: aErr.message || "Failed to create assignments" }, 500);
      }
    }

    // Fire grouped notification (best-effort)
    try {
      admin.functions.invoke("notify-service-roster", {
        body: { group_id: group.id, tenant_id },
        headers: { Authorization: `Bearer ${serviceKey}` },
      }).then(({ error }) => {
        if (error) console.warn("[create-service-roster] notify error", error);
      }).catch((e) => console.warn("[create-service-roster] notify threw", e));
    } catch (e) {
      console.warn("[create-service-roster] notify invoke failed", e);
    }

    return json({ success: true, group_id: group.id, task_ids: taskIds });
  } catch (e) {
    console.error("[create-service-roster] unexpected", e);
    return json({ error: (e as Error)?.message || "Unexpected error" }, 500);
  }
});
