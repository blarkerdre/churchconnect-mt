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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { user_id, disabled } = await req.json();
    if (!user_id || typeof disabled !== "boolean") {
      return new Response(JSON.stringify({ error: "user_id and disabled (boolean) required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prevent self-disable
    if (user_id === caller.id) {
      return new Response(JSON.stringify({ error: "Cannot disable your own account" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Prevent non-super-admin from disabling super_admin accounts
    const { data: targetIsSuperAdmin } = await supabase.rpc("has_role", { _user_id: user_id, _role: "super_admin" });
    if (targetIsSuperAdmin) {
      const { data: callerIsSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
      if (!callerIsSuperAdmin) {
        return new Response(JSON.stringify({ error: "Only super-admins can disable super-admin accounts" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    // Use ban_duration to disable/enable. "none" unbans, a large duration effectively bans.
    const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
      ban_duration: disabled ? "876000h" : "none", // ~100 years ban or unban
    });

    if (updateError) {
      return new Response(JSON.stringify({ error: updateError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    return new Response(JSON.stringify({ success: true, disabled }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
