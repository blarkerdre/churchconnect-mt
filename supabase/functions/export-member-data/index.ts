import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAudit } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tables scoped by user_id
const USER_ID_TABLES = [
  "profiles", "sermon_notes", "sermon_note_folders", "testimonies", "app_feedback",
  "push_subscriptions", "user_tour_completions", "user_roles", "tenant_memberships",
  "consent_events", "erasure_requests",
];
// Tables scoped by member_id (found via members.user_id = auth.uid())
const MEMBER_ID_TABLES = [
  "attendance_records", "event_registrations", "followups", "pastoral_care",
  "training_completions", "member_status_history", "wsf_attendance",
  "course_registrations", "exam_attempts", "exam_answers", "life_event_requests",
  "call_log", "sms_log", "notifications",
];

async function hashIp(ip: string): Promise<string> {
  const buf = new TextEncoder().encode(ip);
  const digest = await crypto.subtle.digest("SHA-256", buf);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Require an approved, unexpired, single-use request
    let requestId: string | null = null;
    try {
      const body = await req.json();
      requestId = body?.request_id ?? null;
    } catch { /* no body */ }

    if (!requestId) {
      return new Response(JSON.stringify({ error: "Missing request_id. Data downloads require admin approval." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: reqRow, error: reqErr } = await admin
      .from("data_export_requests")
      .select("*")
      .eq("id", requestId)
      .maybeSingle();
    if (reqErr || !reqRow) {
      return new Response(JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (reqRow.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (reqRow.status !== "approved") {
      return new Response(JSON.stringify({ error: `Request is ${reqRow.status}; admin approval required.` }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (reqRow.downloaded_at) {
      return new Response(JSON.stringify({ error: "This approval has already been used. Please submit a new request." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (reqRow.expires_at && new Date(reqRow.expires_at).getTime() < Date.now()) {
      await admin.from("data_export_requests")
        .update({ status: "expired" }).eq("id", reqRow.id);
      return new Response(JSON.stringify({ error: "Approval expired. Please submit a new request." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }


    const exportData: Record<string, unknown[]> = {};
    const errors: Record<string, string> = {};

    // Members rows for this user (may be in multiple tenants)
    const { data: memberRows } = await admin.from("members").select("*").eq("user_id", user.id);
    exportData["members"] = memberRows || [];
    const memberIds = (memberRows || []).map((m: any) => m.id);

    // user_id-scoped tables
    for (const t of USER_ID_TABLES) {
      try {
        const { data, error } = await admin.from(t).select("*").eq("user_id", user.id);
        if (error) errors[t] = error.message; else exportData[t] = data || [];
      } catch (e) { errors[t] = String(e); }
    }

    // member_id-scoped tables
    if (memberIds.length > 0) {
      for (const t of MEMBER_ID_TABLES) {
        try {
          const { data, error } = await admin.from(t).select("*").in("member_id", memberIds);
          if (error) errors[t] = error.message; else exportData[t] = data || [];
        } catch (e) { errors[t] = String(e); }
      }
    }

    // Auth account metadata (safe subset)
    exportData["_account"] = [{
      id: user.id,
      email: user.email,
      phone: user.phone,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
      app_metadata: user.app_metadata,
      user_metadata: user.user_metadata,
    }];

    // Mark request as single-use consumed
    await admin.from("data_export_requests")
      .update({ status: "downloaded", downloaded_at: new Date().toISOString() })
      .eq("id", reqRow.id);

    // Audit + notice
    await writeAudit(admin, {
      tenant_id: reqRow.tenant_id ?? memberRows?.[0]?.tenant_id ?? null,
      user_id: user.id,
      action: "dsr_export",
      entity_type: "data_export_request",
      entity_id: reqRow.id,
      details: { tables: Object.keys(exportData).length },
    });


    return new Response(JSON.stringify({
      success: true,
      generated_at: new Date().toISOString(),
      subject: { user_id: user.id, email: user.email },
      data: exportData,
      errors: Object.keys(errors).length ? errors : undefined,
      notice: "This export contains personal data held about you under UK GDPR Article 15. Handle securely.",
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("export-member-data error:", err);
    return new Response(JSON.stringify({ error: "Export failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
