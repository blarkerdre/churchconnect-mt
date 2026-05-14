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

    // Verify caller is super_admin (only super_admins can delete users)
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
    if (!isSuperAdmin) return new Response(JSON.stringify({ error: "Only super-admins can delete user accounts" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { user_id } = await req.json();
    if (!user_id) return new Response(JSON.stringify({ error: "user_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Prevent self-deletion
    if (user_id === caller.id) return new Response(JSON.stringify({ error: "Cannot delete yourself" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Prevent admin from deleting super_admin accounts
    const { data: targetIsSuperAdmin } = await supabase.rpc("has_role", { _user_id: user_id, _role: "super_admin" });
    if (targetIsSuperAdmin) {
      const { data: callerIsSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
      if (!callerIsSuperAdmin) return new Response(JSON.stringify({ error: "Only super-admins can delete super-admin accounts" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Clear all foreign key references before deleting
    await Promise.all([
      supabase.from("followups").update({ assigned_to: null }).eq("assigned_to", user_id),
      supabase.from("followups").update({ created_by: null }).eq("created_by", user_id),
      supabase.from("pastoral_care").update({ assigned_to: null }).eq("assigned_to", user_id),
      supabase.from("pastoral_care").update({ created_by: null }).eq("created_by", user_id),
      supabase.from("members").update({ user_id: null }).eq("user_id", user_id),
      supabase.from("events").update({ created_by: null }).eq("created_by", user_id),
      supabase.from("attendance_sessions").update({ created_by: null }).eq("created_by", user_id),
      supabase.from("wsf_attendance").update({ recorded_by: null }).eq("recorded_by", user_id),
      supabase.from("first_timers").update({ follow_up_assigned_to: null }).eq("follow_up_assigned_to", user_id),
      supabase.from("announcements").update({ created_by: null }).eq("created_by", user_id),
      supabase.from("transportation").update({ user_id: null }).eq("user_id", user_id),
      supabase.from("app_settings").update({ updated_by: null }).eq("updated_by", user_id),
    ]);

    // Nullify message references (sender_id is NOT NULL, so delete instead)
    await supabase.from("messages").delete().eq("sender_id", user_id);
    await supabase.from("messages").update({ recipient_id: null }).eq("recipient_id", user_id);

    // Delete owned records (including tenant_memberships)
    await Promise.all([
      supabase.from("event_registrations").delete().eq("user_id", user_id),
      supabase.from("unit_leader_assignments").delete().eq("user_id", user_id),
      supabase.from("notifications").delete().eq("user_id", user_id),
      supabase.from("audit_log").delete().eq("user_id", user_id),
      supabase.from("sms_log").delete().eq("sender_id", user_id),
      supabase.from("user_roles").delete().eq("user_id", user_id),
      supabase.from("profiles").delete().eq("user_id", user_id),
      supabase.from("tenant_memberships").delete().eq("user_id", user_id),
    ]);

    // Finally delete the auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteError) {
      console.error("admin-delete-user error:", deleteError);
      return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("admin-delete-user error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
