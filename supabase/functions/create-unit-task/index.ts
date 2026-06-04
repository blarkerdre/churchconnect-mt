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
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }

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
      title,
      description,
      due_date,
      priority,
      member_ids,
    } = body || {};

    if (!tenant_id) return json({ error: "tenant_id is required" }, 400);
    if (!unit_name || typeof unit_name !== "string") return json({ error: "unit_name is required" }, 400);
    if (!title || typeof title !== "string" || !title.trim()) return json({ error: "title is required" }, 400);
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      return json({ error: "Select at least one member" }, 400);
    }

    // Permission: super_admin, tenant admin/owner, or unit leader
    const [{ data: isSuper }, { data: isAdminFlag }, { data: leadsUnit }] = await Promise.all([
      admin.rpc("has_role", { _user_id: user.id, _role: "super_admin" }),
      admin.rpc("is_admin", { _user_id: user.id, _tenant_id: tenant_id }),
      admin.rpc("user_leads_unit", { _user_id: user.id, _unit_name: unit_name, _tenant_id: tenant_id }),
    ]);

    if (!isSuper && !isAdminFlag && !leadsUnit) {
      return json({ error: "You don't have permission to create tasks for this unit." }, 403);
    }

    console.log("[create-unit-task] permission OK", { user: user.id, tenant_id, unit_name });

    // Resolve members within tenant only
    const { data: members, error: mErr } = await admin
      .from("members")
      .select("id, user_id, tenant_id")
      .eq("tenant_id", tenant_id)
      .in("id", member_ids);
    if (mErr) {
      console.error("[create-unit-task] member lookup failed", mErr);
      return json({ error: "Failed to resolve members" }, 500);
    }
    if (!members || members.length === 0) {
      return json({ error: "No valid members for this tenant" }, 400);
    }

    // Create task
    const { data: task, error: tErr } = await admin
      .from("unit_tasks")
      .insert({
        tenant_id,
        unit_name,
        title: title.trim(),
        description: (description || "").trim() || null,
        due_date: due_date || null,
        priority: priority || "Medium",
        status: "Open",
        created_by: user.id,
      })
      .select()
      .single();
    if (tErr || !task) {
      console.error("[create-unit-task] task insert failed", tErr);
      return json({ error: tErr?.message || "Failed to create task" }, 500);
    }
    console.log("[create-unit-task] task created", task.id);

    // Insert assignments
    const rows = members.map((m) => ({
      tenant_id,
      task_id: task.id,
      member_id: m.id,
      user_id: m.user_id || null,
      status: "Pending",
    }));
    const { error: aErr } = await admin.from("unit_task_assignments").insert(rows);
    if (aErr) {
      console.error("[create-unit-task] assignments insert failed", aErr);
      await admin.from("unit_tasks").delete().eq("id", task.id).eq("tenant_id", tenant_id);
      return json({ error: aErr.message || "Failed to create assignments" }, 500);
    }
    console.log("[create-unit-task] assignments created", rows.length);

    // Fire notifications (best-effort) — call with service role so it bypasses user checks
    try {
      admin.functions.invoke("notify-unit-task-assignment", {
        body: { task_id: task.id, tenant_id },
        headers: { Authorization: `Bearer ${serviceKey}` },
      }).then(({ error }) => {
        if (error) console.warn("[create-unit-task] notify error", error);
        else console.log("[create-unit-task] notify dispatched");
      }).catch((e) => console.warn("[create-unit-task] notify threw", e));
    } catch (e) {
      console.warn("[create-unit-task] notify invoke failed", e);
    }

    return json({ success: true, task, assignments: rows.length });
  } catch (e) {
    console.error("[create-unit-task] unexpected", e);
    return json({ error: (e as Error)?.message || "Unexpected error" }, 500);
  }
});
