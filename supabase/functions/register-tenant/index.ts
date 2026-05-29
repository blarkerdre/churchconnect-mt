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

    // Validate slug format & length
    if (!/^[a-z0-9-]+$/.test(slug) || slug.length < 3 || slug.length > 40) {
      return new Response(
        JSON.stringify({ error: "Slug must be 3-40 characters of lowercase letters, numbers, and hyphens" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Reject reserved slugs
    const RESERVED_SLUGS = new Set([
      "admin", "api", "auth", "app", "www", "t", "onboard", "landing",
      "public", "static", "assets", "settings", "dashboard", "system",
    ]);
    if (RESERVED_SLUGS.has(slug)) {
      return new Response(
        JSON.stringify({ error: "This slug is reserved. Please choose a different one." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate church_name, email, password
    if (typeof church_name !== "string" || church_name.trim().length < 2 || church_name.length > 120) {
      return new Response(
        JSON.stringify({ error: "Church name must be between 2 and 120 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof admin_email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(admin_email) || admin_email.length > 255) {
      return new Response(
        JSON.stringify({ error: "A valid admin email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (typeof admin_password !== "string" || admin_password.length < 10 || admin_password.length > 200) {
      return new Response(
        JSON.stringify({ error: "Admin password must be at least 10 characters" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      if (userError.message?.includes("already been registered")) {
        // SECURITY: never silently assign an existing user as owner of a new
        // tenant they didn't authorize. Require them to sign in / use a fresh email.
        return new Response(
          JSON.stringify({
            error:
              "This email is already registered. Please sign in with that account or use a different email to create the church.",
          }),
          { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      console.error("register-tenant: createUser failed:", userError);
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = newUser.user.id;

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
      console.error("register-tenant: tenant insert failed:", tenantError);
      await admin.auth.admin.deleteUser(userId);
      return new Response(
        JSON.stringify({ error: "An unexpected error occurred" }),
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

    // 5. Create user_roles entry (tenant-scoped admin only — never platform super_admin)
    await admin.from("user_roles").insert({
      user_id: userId,
      role: "admin",
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

    // 8. Send welcome email to the new tenant admin
    const loginUrl = `https://app.churchmanagementsuite.org/t/${slug}/auth`;
    try {
      await admin.functions.invoke("send-transactional-email", {
        body: {
          templateName: "tenant-welcome",
          recipientEmail: admin_email,
          idempotencyKey: `tenant-welcome-${tenant.id}`,
          templateData: {
            name: admin_full_name || admin_email,
            churchName: church_name,
            slug,
            loginUrl,
          },
        },
      });
    } catch (e) {
      console.error("Failed to send welcome email:", e);
    }

    // 9. Notify platform super admins about the new tenant
    try {
      const { data: superAdminRoles } = await admin
        .from("user_roles")
        .select("user_id")
        .eq("role", "super_admin")
        .is("tenant_id", null);

      if (superAdminRoles && superAdminRoles.length > 0) {
        const superAdminUserIds = superAdminRoles
          .map((r: any) => r.user_id)
          .filter((uid: string) => uid !== userId);

        if (superAdminUserIds.length > 0) {
          const { data: adminProfiles } = await admin
            .from("profiles")
            .select("email")
            .in("user_id", superAdminUserIds);

          const createdAt = new Date().toISOString();
          for (const profile of adminProfiles || []) {
            if (!profile.email) continue;
            try {
              await admin.functions.invoke("send-transactional-email", {
                body: {
                  templateName: "new-tenant-notification",
                  recipientEmail: profile.email,
                  idempotencyKey: `new-tenant-notify-${tenant.id}-${profile.email}`,
                  templateData: {
                    churchName: church_name,
                    slug,
                    adminName: admin_full_name || admin_email,
                    adminEmail: admin_email,
                    createdAt,
                  },
                },
              });
            } catch (e) {
              console.error("Failed to notify super admin:", profile.email, e);
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to query super admins for notification:", e);
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