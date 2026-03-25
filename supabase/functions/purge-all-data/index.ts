import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // 1. Verify JWT from Authorization header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: userError,
    } = await anonClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check super_admin role
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleCheck } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ error: "Only super admins can perform this action" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 3. Parse body and validate
    const { password, tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(
        JSON.stringify({ error: "tenant_id is required" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required for re-authentication" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 4. Verify caller belongs to this tenant
    const { data: belongsToTenant } = await adminClient.rpc("user_belongs_to_tenant", {
      _user_id: user.id,
      _tenant_id: tenant_id,
    });

    if (!belongsToTenant) {
      return new Response(
        JSON.stringify({ error: "You do not belong to this tenant" }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // 5. Re-authenticate with password
    const { error: signInError } = await adminClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return new Response(
        JSON.stringify({ error: "Invalid password. Action denied." }),
        {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const actingUserId = user.id;

    // 6. Delete transactional data scoped to tenant in FK-safe order

    // Exam related (child first)
    await adminClient.from("exam_answers").delete().eq("tenant_id", tenant_id);
    await adminClient.from("exam_attempts").delete().eq("tenant_id", tenant_id);
    await adminClient.from("course_registrations").delete().eq("tenant_id", tenant_id);

    // Attendance
    await adminClient.from("attendance_records").delete().eq("tenant_id", tenant_id);
    await adminClient.from("attendance_sessions").delete().eq("tenant_id", tenant_id);

    // WSF attendance
    await adminClient.from("wsf_attendance").delete().eq("tenant_id", tenant_id);
    await adminClient.from("wsf_attendance_reports").delete().eq("tenant_id", tenant_id);

    // Follow-ups & pastoral care
    await adminClient.from("followups").delete().eq("tenant_id", tenant_id);
    await adminClient.from("pastoral_care").delete().eq("tenant_id", tenant_id);

    // Events
    await adminClient.from("event_registrations").delete().eq("tenant_id", tenant_id);
    await adminClient.from("events").delete().eq("tenant_id", tenant_id);

    // Communications
    await adminClient.from("announcements").delete().eq("tenant_id", tenant_id);
    await adminClient.from("messages").delete().eq("tenant_id", tenant_id);
    await adminClient.from("notifications").delete().eq("tenant_id", tenant_id);
    await adminClient.from("sms_log").delete().eq("tenant_id", tenant_id);
    await adminClient.from("email_send_log").delete().eq("tenant_id", tenant_id);

    // Transportation
    await adminClient.from("transportation").delete().eq("tenant_id", tenant_id);

    // Documents
    await adminClient.from("documents").delete().eq("tenant_id", tenant_id);

    // First timers
    await adminClient.from("first_timers").delete().eq("tenant_id", tenant_id);

    // Member status history
    await adminClient.from("member_status_history").delete().eq("tenant_id", tenant_id);

    // Training
    await adminClient.from("training_completions").delete().eq("tenant_id", tenant_id);
    await adminClient.from("training_reports").delete().eq("tenant_id", tenant_id);
    await adminClient.from("church_attendance_reports").delete().eq("tenant_id", tenant_id);

    // Audit log
    await adminClient.from("audit_log").delete().eq("tenant_id", tenant_id);

    // Suppressed emails
    await adminClient.from("suppressed_emails").delete().eq("tenant_id", tenant_id);

    // Members
    await adminClient.from("members").delete().eq("tenant_id", tenant_id);

    // Unit leader assignments
    await adminClient.from("unit_leader_assignments").delete().eq("tenant_id", tenant_id);

    // 7. Get tenant users (excluding acting admin) for account cleanup
    const { data: tenantUsers } = await adminClient
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .neq("user_id", actingUserId);

    // Remove profiles for tenant users (except acting admin)
    await adminClient.from("profiles").delete()
      .eq("tenant_id", tenant_id)
      .neq("user_id", actingUserId);

    // Remove user_roles for tenant users (except acting admin)
    if (tenantUsers && tenantUsers.length > 0) {
      const userIds = tenantUsers.map((u) => u.user_id);
      await adminClient.from("user_roles").delete().in("user_id", userIds);
    }

    // 8. Clear storage bucket files prefixed with tenant_id
    try {
      const { data: files } = await adminClient.storage
        .from("church-documents")
        .list(tenant_id, { limit: 1000 });

      if (files && files.length > 0) {
        const filePaths = files.map((f) => `${tenant_id}/${f.name}`);
        await adminClient.storage.from("church-documents").remove(filePaths);
      }
    } catch (storageErr) {
      console.error("Storage cleanup error (non-fatal):", storageErr);
    }

    // 9. Delete other auth users who only belong to this tenant
    if (tenantUsers && tenantUsers.length > 0) {
      for (const tu of tenantUsers) {
        // Check if user belongs to other tenants
        const { data: otherMemberships } = await adminClient
          .from("tenant_memberships")
          .select("id")
          .eq("user_id", tu.user_id)
          .neq("tenant_id", tenant_id)
          .limit(1);

        // Remove their membership from this tenant
        await adminClient
          .from("tenant_memberships")
          .delete()
          .eq("user_id", tu.user_id)
          .eq("tenant_id", tenant_id);

        // Only delete auth user if they don't belong to other tenants
        if (!otherMemberships || otherMemberships.length === 0) {
          await adminClient.auth.admin.deleteUser(tu.user_id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "All tenant data has been purged successfully." }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Purge error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred during the purge." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
