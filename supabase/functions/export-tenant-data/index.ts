import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPORT_TABLES = [
  "members",
  "attendance_sessions",
  "attendance_records",
  "events",
  "event_registrations",
  "followups",
  "pastoral_care",
  "announcements",
  "messages",
  "notifications",
  "sms_log",
  "email_send_log",
  "transportation",
  "documents",
  "first_timers",
  "member_status_history",
  "training_completions",
  "training_reports",
  "church_attendance_reports",
  "exam_answers",
  "exam_attempts",
  "course_registrations",
  "wsf_attendance",
  "wsf_attendance_reports",
  "unit_leader_assignments",
  "audit_log",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleCheck } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });

    if (!roleCheck) {
      return new Response(JSON.stringify({ error: "Only super admins can export data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: belongsToTenant } = await adminClient.rpc("user_belongs_to_tenant", {
      _user_id: user.id,
      _tenant_id: tenant_id,
    });

    if (!belongsToTenant) {
      return new Response(JSON.stringify({ error: "You do not belong to this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const exportData: Record<string, unknown[]> = {};

    for (const table of EXPORT_TABLES) {
      try {
        const { data, error } = await adminClient
          .from(table)
          .select("*")
          .eq("tenant_id", tenant_id);

        if (error) {
          console.error(`Error exporting ${table}:`, error.message);
          exportData[table] = [];
        } else {
          exportData[table] = data || [];
        }
      } catch (e) {
        console.error(`Table ${table} not found or error:`, e);
        exportData[table] = [];
      }
    }

    return new Response(JSON.stringify({ success: true, data: exportData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Export error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred during export." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
