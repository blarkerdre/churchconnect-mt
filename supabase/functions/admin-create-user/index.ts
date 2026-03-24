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

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin access required" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { email, password, full_name, role, member_data, tenant_id } = await req.json();
    if (!email || !password) return new Response(JSON.stringify({ error: "Email and password required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Only super_admin can assign elevated roles
    if (role && ['admin', 'super_admin'].includes(role)) {
      const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
      if (!isSuperAdmin) return new Response(JSON.stringify({ error: "Super-admin access required to assign elevated roles" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user via admin API
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: full_name || email },
    });

    if (createError) return new Response(JSON.stringify({ error: createError.message }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userId = newUser?.user?.id;

    // Assign role (with tenant_id)
    if (role && userId) {
      await supabase.from("user_roles").insert({ user_id: userId, role, ...(tenant_id ? { tenant_id } : {}) });
    }

    // Add tenant membership if tenant_id provided
    if (tenant_id && userId) {
      await supabase.from("tenant_memberships").insert({ user_id: userId, tenant_id, role: "member" });
    }

    // Update profile with tenant_id if available
    if (tenant_id && userId) {
      await supabase.from("profiles").update({ tenant_id }).eq("user_id", userId);
    }

    // Create linked member record if member_data provided
    let memberId = null;
    if (member_data && userId) {
      const memberPayload = {
        first_name: member_data.first_name,
        last_name: member_data.last_name,
        email: member_data.email || email,
        phone: member_data.phone || null,
        address: member_data.address || null,
        city: member_data.city || null,
        postcode: member_data.postcode || null,
        date_of_birth: member_data.date_of_birth || null,
        gender: member_data.gender || null,
        membership_status: member_data.membership_status || "Active",
        church_unit: member_data.church_unit || null,
        notes: member_data.notes || null,
        emergency_contact_name: member_data.emergency_contact_name || null,
        emergency_contact_phone: member_data.emergency_contact_phone || null,
        water_baptism: member_data.water_baptism ?? false,
        holy_spirit_baptism: member_data.holy_spirit_baptism ?? false,
        winners_satellite: member_data.winners_satellite ?? false,
        wsf_centre_id: member_data.wsf_centre_id || null,
        workers_in_training: member_data.workers_in_training ?? false,
        bfc_completed: member_data.bfc_completed ?? false,
        bcc_completed: member_data.bcc_completed ?? false,
        lcc_completed: member_data.lcc_completed ?? false,
        ldc_completed: member_data.ldc_completed ?? false,
        gdpr_consent: member_data.gdpr_consent ?? false,
        gdpr_consent_date: member_data.gdpr_consent_date || null,
        user_id: userId,
        ...(tenant_id ? { tenant_id } : {}),
      };

      const { data: memberRow, error: memberError } = await supabase
        .from("members")
        .insert(memberPayload)
        .select("id")
        .single();

      if (memberError) {
        return new Response(JSON.stringify({ error: `User created but member creation failed: ${memberError.message}`, user_id: userId }), {
          status: 207,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      memberId = memberRow?.id;
    } else if (userId) {
      // No member_data provided — try to auto-link existing unlinked member by email
      const { data: linkedMemberId } = await supabase.rpc("auto_link_member_by_email", {
        _user_id: userId,
        _email: email,
      });
      if (linkedMemberId) memberId = linkedMemberId;
    }

    return new Response(JSON.stringify({ success: true, user_id: userId, member_id: memberId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
