import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const EXPORT_TABLES = [
  "members",
  "attendance_sessions",
  "attendance_records",
  "events",
  "event_registrations",
  "followups",
  "pastoral_care",
  "announcements",
  "messages",
  "notifications",
  "sms_log",
  "email_send_log",
  "transportation",
  "documents",
  "first_timers",
  "member_status_history",
  "training_completions",
  "training_reports",
  "church_attendance_reports",
  "exam_answers",
  "exam_attempts",
  "course_registrations",
  "wsf_attendance",
  "wsf_attendance_reports",
  "unit_leader_assignments",
  "audit_log",
];

async function snapshotTenantData(
  adminClient: ReturnType<typeof createClient>,
  tenantId: string
): Promise<Record<string, unknown[]>> {
  const snapshot: Record<string, unknown[]> = {};

  for (const table of EXPORT_TABLES) {
    try {
      const { data } = await adminClient
        .from(table)
        .select("*")
        .eq("tenant_id", tenantId);
      snapshot[table] = data || [];
    } catch {
      snapshot[table] = [];
    }
  }

  return snapshot;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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

    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: roleCheck } = await adminClient.rpc("has_role", {
      _user_id: user.id,
      _role: "super_admin",
    });

    if (!roleCheck) {
      return new Response(
        JSON.stringify({ error: "Only super admins can perform this action" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { password, tenant_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!password) {
      return new Response(JSON.stringify({ error: "Password is required for re-authentication" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: belongsToTenant } = await adminClient.rpc("user_belongs_to_tenant", {
      _user_id: user.id,
      _tenant_id: tenant_id,
    });

    if (!belongsToTenant) {
      return new Response(JSON.stringify({ error: "You do not belong to this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: signInError } = await adminClient.auth.signInWithPassword({
      email: user.email!,
      password,
    });

    if (signInError) {
      return new Response(JSON.stringify({ error: "Invalid password. Action denied." }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actingUserId = user.id;

    // ── STEP 1: Snapshot all tenant data before deletion ──
    const snapshotData = await snapshotTenantData(adminClient, tenant_id);

    // Also snapshot profiles and user_roles for tenant users (excluding acting admin)
    const { data: tenantUsers } = await adminClient
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .neq("user_id", actingUserId);

    if (tenantUsers && tenantUsers.length > 0) {
      const userIds = tenantUsers.map((u) => u.user_id);

      const { data: profiles } = await adminClient
        .from("profiles")
        .select("*")
        .eq("tenant_id", tenant_id)
        .neq("user_id", actingUserId);
      snapshotData["profiles"] = profiles || [];

      const { data: roles } = await adminClient
        .from("user_roles")
        .select("*")
        .in("user_id", userIds);
      snapshotData["user_roles"] = roles || [];
    }

    // Save archive
    let archiveId: string | null = null;
    const hasData = Object.values(snapshotData).some((arr) => arr.length > 0);

    if (hasData) {
      const { data: archive, error: archiveError } = await adminClient
        .from("purged_data_archives")
        .insert({
          tenant_id,
          purged_by: actingUserId,
          data: snapshotData,
        })
        .select("id")
        .single();

      if (archiveError) {
        console.error("Archive creation error:", archiveError);
      } else {
        archiveId = archive?.id || null;
      }
    }

    // ── STEP 2: Delete transactional data (same as before) ──

    // Exam related
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

    // Profiles (except acting admin)
    await adminClient.from("profiles").delete()
      .eq("tenant_id", tenant_id)
      .neq("user_id", actingUserId);

    // User roles for tenant users (except acting admin)
    if (tenantUsers && tenantUsers.length > 0) {
      const userIds = tenantUsers.map((u) => u.user_id);
      await adminClient.from("user_roles").delete().in("user_id", userIds);
    }

    // Storage cleanup
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

    // Delete auth users who only belong to this tenant
    if (tenantUsers && tenantUsers.length > 0) {
      for (const tu of tenantUsers) {
        const { data: otherMemberships } = await adminClient
          .from("tenant_memberships")
          .select("id")
          .eq("user_id", tu.user_id)
          .neq("tenant_id", tenant_id)
          .limit(1);

        await adminClient
          .from("tenant_memberships")
          .delete()
          .eq("user_id", tu.user_id)
          .eq("tenant_id", tenant_id);

        if (!otherMemberships || otherMemberships.length === 0) {
          await adminClient.auth.admin.deleteUser(tu.user_id);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "All tenant data has been purged successfully.",
        archive_id: archiveId,
        recovery_days: 30,
      }),
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
