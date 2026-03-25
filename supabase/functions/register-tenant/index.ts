import { createClient } from "npm:@supabase/supabase-js@2";

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

    // 1. Create auth user or reuse existing
    let userId: string;
    const { data: newUser, error: userError } = await admin.auth.admin.createUser({
      email: admin_email,
      password: admin_password,
      email_confirm: true,
      user_metadata: { full_name: admin_full_name || admin_email },
    });

    if (userError) {
      // If user already exists, look them up and reuse
      if (userError.message?.includes("already been registered")) {
        const { data: { users }, error: listError } = await admin.auth.admin.listUsers();
        if (listError) {
          return new Response(
            JSON.stringify({ error: "Failed to look up existing user" }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        const existingUser = users.find((u: any) => u.email?.toLowerCase() === admin_email.toLowerCase());
        if (!existingUser) {
          return new Response(
            JSON.stringify({ error: "User exists but could not be found" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        userId = existingUser.id;
      } else {
        return new Response(
          JSON.stringify({ error: userError.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      userId = newUser.user.id;
    }

    // 2. Build disabled_features array from feature toggles
    // Features map: key -> route path
    const featureRouteMap: Record<string, string> = {
      sms_enabled: "/communications",
      exams_enabled: "/exam-management",
      transportation: "/transportation",
      pastoral_care: "/pastoral-care",
      wsf_enabled: "/wsf",
    };

    const disabledFeatures: string[] = [];
    if (features) {
      for (const [key, route] of Object.entries(featureRouteMap)) {
        if (features[key] === false) {
          disabledFeatures.push(route);
        }
      }
    }

    // 3. Create tenant
    const { data: tenant, error: tenantError } = await admin
      .from("tenants")
      .insert({
        name: church_name,
        slug,
        timezone: timezone || "Europe/London",
        logo_url: logo_url || null,
        created_by: userId,
        settings: {
          features: features || {},
          disabled_features: disabledFeatures,
        },
        setup_complete: true,
      })
      .select("id")
      .single();

    if (tenantError) {
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: `Tenant creation failed: ${tenantError.message}` }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Create tenant membership (owner)
    await admin.from("tenant_memberships").insert({
      tenant_id: tenant.id,
      user_id: userId,
      role: "owner",
    });

    // 5. Create user_roles entry (super_admin for the tenant owner)
    await admin.from("user_roles").insert({
      user_id: userId,
      role: "super_admin",
      tenant_id: tenant.id,
    });

    // 6. Update profile (created by handle_new_user trigger) with tenant_id
    await admin.from("profiles").update({
      full_name: admin_full_name || admin_email,
      tenant_id: tenant.id,
    }).eq("user_id", userId);

    // 7. Seed app_settings with disabled_features for this tenant
    if (disabledFeatures.length > 0) {
      await admin.from("app_settings").insert({
        key: "disabled_features",
        value: disabledFeatures,
        tenant_id: tenant.id,
        updated_by: userId,
      });
    }

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