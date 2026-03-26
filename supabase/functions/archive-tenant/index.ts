import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

    // Only super_admins can archive/delete tenants
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
      // Require password re-authentication for permanent delete
      if (!password) {
        return new Response(JSON.stringify({ error: "Password required for permanent deletion" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Verify password by signing in
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: caller.email!,
        password,
      });
      if (authError) {
        return new Response(JSON.stringify({ error: "Invalid password. Deletion aborted." }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Delete all tenant data in order (respecting FK constraints)
      const tables = [
        "tenant_invitations", "notifications", "messages", "audit_log",
        "exam_answers", "exam_attempts", "exam_questions", "exam_session_courses",
        "exam_sessions", "exam_subjects", "exam_titles", "course_registrations",
        "attendance_records", "attendance_sessions", "event_registrations", "events",
        "followups", "first_timers", "pastoral_care", "member_status_history",
        "documents", "sms_log", "email_send_log", "church_attendance_reports",
        "pickup_locations", "certificate_templates", "books_of_the_month",
        "announcements", "app_settings", "members", "church_units",
        "wsf_centres", "wsf_zones", "tenant_memberships", "profiles",
      ];

      for (const table of tables) {
        await supabase.from(table).delete().eq("tenant_id", tenant_id);
      }

      // Finally delete the tenant itself
      const { error } = await supabase.from("tenants").delete().eq("id", tenant_id);
      if (error) throw error;

      return new Response(JSON.stringify({ success: true, action: "deleted" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
