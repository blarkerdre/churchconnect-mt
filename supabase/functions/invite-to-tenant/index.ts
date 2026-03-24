import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
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

    const { tenant_id, email, role = "member" } = await req.json();
    if (!tenant_id || !email) {
      return new Response(JSON.stringify({ error: "tenant_id and email required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify caller is admin or tenant admin
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id });
    const { data: isTenantAdmin } = await supabase.rpc("is_tenant_admin", { _user_id: caller.id, _tenant_id: tenant_id });
    if (!isAdmin && !isTenantAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user already exists
    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("user_id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (existingProfile) {
      // Check if already a member of this tenant
      const { data: existingMembership } = await supabase
        .from("tenant_memberships")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", existingProfile.user_id)
        .maybeSingle();

      if (existingMembership) {
        return new Response(JSON.stringify({ error: "User is already a member of this tenant" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Auto-add existing user to tenant
      const { error: membershipError } = await supabase.from("tenant_memberships").insert({
        tenant_id,
        user_id: existingProfile.user_id,
        role,
      });
      if (membershipError) throw membershipError;

      // Notify them
      await supabase.from("notifications").insert({
        user_id: existingProfile.user_id,
        title: "You've been added to a new church",
        message: `An admin has added you to a church. Switch to it using the tenant switcher.`,
        type: "general",
        tenant_id,
      });

      return new Response(JSON.stringify({ success: true, auto_added: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // User doesn't exist — check for pending invitation
    const { data: existingInvite } = await supabase
      .from("tenant_invitations")
      .select("id")
      .eq("tenant_id", tenant_id)
      .eq("email", normalizedEmail)
      .eq("status", "pending")
      .maybeSingle();

    if (existingInvite) {
      return new Response(JSON.stringify({ error: "An invitation is already pending for this email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create invitation record
    const { data: invitation, error: invError } = await supabase
      .from("tenant_invitations")
      .insert({
        tenant_id,
        email: normalizedEmail,
        role,
        invited_by: caller.id,
      })
      .select()
      .single();

    if (invError) throw invError;

    return new Response(JSON.stringify({ success: true, invitation_id: invitation.id, auto_added: false }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
