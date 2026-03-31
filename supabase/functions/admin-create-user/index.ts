import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getOrCreateAuthUser(supabase: ReturnType<typeof createClient>, email: string, password: string, fullName: string, tenantSlug?: string) {
  const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName, ...(tenantSlug ? { tenant_slug: tenantSlug } : {}) },
  });

  if (!createError) {
    return { userId: newUser.user.id, reusedExisting: false };
  }

  if (!createError.message?.toLowerCase().includes("already been registered")) {
    throw createError;
  }

  const { data, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) throw listError;

  const existingUser = data.users.find((user) => user.email?.toLowerCase() === email.toLowerCase());
  if (!existingUser) {
    throw new Error("User exists in authentication but could not be resolved.");
  }

  return { userId: existingUser.id, reusedExisting: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user: caller } } = await supabase.auth.getUser(token);
    if (!caller) return jsonResponse({ error: "Unauthorized" }, 401);

    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: caller.id });
    if (!isAdmin) return jsonResponse({ error: "Admin access required" }, 403);

    const { email, password, full_name, role, member_data, tenant_id } = await req.json();
    if (!email || !password) return jsonResponse({ error: "Email and password required" }, 400);

    const normalizedEmail = String(email).trim().toLowerCase();
    const normalizedFullName = String(full_name || email).trim();

    // Only super_admin can assign elevated roles
    if (role && ['admin', 'super_admin'].includes(role)) {
      const { data: isSuperAdmin } = await supabase.rpc("has_role", { _user_id: caller.id, _role: "super_admin" });
      if (!isSuperAdmin) return jsonResponse({ error: "Super-admin access required to assign elevated roles" }, 403);
    }

    const { userId, reusedExisting } = await getOrCreateAuthUser(
      supabase,
      normalizedEmail,
      password,
      normalizedFullName,
    );

    await supabase.from("profiles").upsert({
      user_id: userId,
      email: normalizedEmail,
      full_name: normalizedFullName,
      ...(tenant_id ? { tenant_id } : {}),
    }, {
      onConflict: "user_id",
    });

    // Assign role (with tenant_id)
    if (role && userId) {
      await supabase.from("user_roles").upsert(
        { user_id: userId, role, ...(tenant_id ? { tenant_id } : {}) },
        { onConflict: "user_id,role" },
      );
    }

    // Add tenant membership if tenant_id provided
    if (tenant_id && userId) {
      const { data: existingMembership } = await supabase
        .from("tenant_memberships")
        .select("id")
        .eq("tenant_id", tenant_id)
        .eq("user_id", userId)
        .maybeSingle();

      if (!existingMembership) {
        const { error: membershipError } = await supabase
          .from("tenant_memberships")
          .insert({ user_id: userId, tenant_id, role: "member" });

        if (membershipError) {
          return jsonResponse({ error: membershipError.message }, 400);
        }
      }
    }

    // Create linked member record if member_data provided
    let memberId = null;
    if (member_data && userId) {
      const memberPayload = {
        first_name: member_data.first_name,
        last_name: member_data.last_name,
        email: member_data.email || normalizedEmail,
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
        return jsonResponse({ error: `User created but member creation failed: ${memberError.message}`, user_id: userId }, 207);
      }
      memberId = memberRow?.id;
    } else if (userId) {
      // No member_data provided — try to auto-link existing unlinked member by email
      const { data: linkedMemberId } = await supabase.rpc("auto_link_member_by_email", {
        _user_id: userId,
        _email: normalizedEmail,
        _tenant_id: tenant_id || null,
      });
      if (linkedMemberId) {
        memberId = linkedMemberId;

        if (tenant_id) {
          const { data: linkedMember } = await supabase
            .from("members")
            .select("tenant_id")
            .eq("id", linkedMemberId)
            .maybeSingle();

          if (linkedMember && !linkedMember.tenant_id) {
            await supabase
              .from("members")
              .update({ tenant_id })
              .eq("id", linkedMemberId);
          }
        }
      }
    }

    return jsonResponse({ success: true, user_id: userId, member_id: memberId, reused_existing_user: reusedExisting });
  } catch (err) {
    return jsonResponse({ error: err.message }, 500);
  }
});
