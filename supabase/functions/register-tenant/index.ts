import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const {
      church_name,
      slug,
      admin_email,
      admin_password,
      admin_full_name,
      timezone,
      logo_url,
      features,
    } = await req.json();

    // Validate required fields
    if (!church_name || !slug || !admin_email || !admin_password) {
      return new Response(
        JSON.stringify({
          error: "church_name, slug, admin_email, and admin_password are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Validate slug format
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return new Response(
        JSON.stringify({ error: "Slug must contain only lowercase letters, numbers, and hyphens" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // Check slug uniqueness
    const { data: existing } = await admin
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ error: "This slug is already taken. Please choose a different one." }),
        {
          status: 409,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 1. Create auth user
    const { data: newUser, error: userError } = await admin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: { full_name: admin_full_name || admin_email },
    });

    if (userError) {
      return new Response(
        JSON.stringify({ error: userError.message }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const userId = newUser.user.id;

    // 2. Create tenant
    const defaultFeatures = {
      sms_enabled: true,
      exams_enabled: true,
      transportation: true,
      pastoral_care: true,
      wsf_enabled: true,
      ...(features || {}),
    };

    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: church_name,
        slug,
        timezone: timezone || "Europe/London",
        logo_url: logo_url || null,
        created_by: userId,
        settings: { features: defaultFeatures },
        setup_complete: false,
      })
      .select("id")
      .single();

    if (tenantError) {
      // Cleanup: delete created user
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Tenant creation failed: ${tenantError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Create tenant membership (owner)
    await admin.from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: "owner",
    });

    // 4. Create user_roles entry (super_admin for the tenant owner)
    await admin.from("user_roles").insert({
      user_id: userId,
      role: "super_admin",
      tenant_id: tenant.id,
    });

    // 5. Create profile
    await admin.from("profiles").insert({
      user_id: userId,
      full_name: admin_full_name || admin_email,
      email: admin_email,
      tenant_id: tenant.id,
    });

    return new Response(
      JSON.stringify({
        success: true,
        tenant_id: tenant.id,
        user_id: userId,
        slug,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Tenant registration error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
