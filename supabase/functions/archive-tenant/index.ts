import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// FK-safe deletion order: children first, parents last
const DELETE_TABLES = [
  "tenant_invitations", "notifications", "messages", "audit_log",
  "exam_answers", "exam_attempts", "exam_questions", "exam_session_courses",
  "exam_sessions", "exam_subjects", "exam_titles", "course_registrations",
  "training_completions", "training_reports",
  "attendance_records", "attendance_sessions",
  "wsf_attendance", "wsf_attendance_reports",
  "event_registrations", "events",
  "followups", "first_timers", "pastoral_care", "member_status_history",
  "documents", "sms_log", "email_send_log", "suppressed_emails",
  "church_attendance_reports", "transportation",
  "pickup_locations", "certificate_templates", "books_of_the_month",
  "announcements", "app_settings",
  "unit_leader_assignments", "user_roles",
  "members", "church_units", "wsf_centres", "wsf_zones",
  "purged_data_archives", "tenant_memberships", "profiles",
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
    if (!isSuperAdmin) {
      return new Response(JSON.stringify({ error: "Super admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, action, password } = await req.json();
    if (!tenant_id || !["archive", "restore", "delete"].includes(action)) {
      return new Response(JSON.stringify({ error: "tenant_id and action (archive|restore|delete) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "archive") {
      const { error } = await supabase.from("tenants").update({
        is_archived: true,
        archived_at: new Date().toISOString(),
        archived_by: caller.id,
      }).eq("id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action: "archived" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "restore") {
      const { error } = await supabase.from("tenants").update({
        is_archived: false,
        archived_at: null,
        archived_by: null,
      }).eq("id", tenant_id);
      if (error) throw error;
      return new Response(JSON.stringify({ success: true, action: "restored" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "delete") {
      if (!password) {
        return new Response(JSON.stringify({ error: "Password required for permanent deletion" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use a separate anon client for password verification so the
      // service-role client's auth state is never contaminated.
      const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
      const anonClient = createClient(supabaseUrl, anonKey);
      const { error: authError } = await anonClient.auth.signInWithPassword({
        email: caller.email!,
        password,
      });
      if (authError) {
        return new Response(JSON.stringify({ error: "Invalid password. Deletion aborted." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete all tenant data in FK-safe order
      for (const table of DELETE_TABLES) {
        const { error } = await supabase.from(table).delete().eq("tenant_id", tenant_id);
        if (error) {
          console.error(`archive-tenant: failed to delete from ${table}:`, error.message);
          // Continue — some tables may not have tenant_id or may be empty
        }
      }

      // Finally delete the tenant itself
      const { error } = await supabase.from("tenants").delete().eq("id", tenant_id);
      if (error) {
        console.error("archive-tenant: failed to delete tenant row:", error.message);
        throw error;
      }

      return new Response(JSON.stringify({ success: true, action: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("archive-tenant error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
