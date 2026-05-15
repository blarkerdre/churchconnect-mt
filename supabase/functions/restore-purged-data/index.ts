import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAudit } from "../_shared/audit.ts";;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Restore order: parents first, then children (reverse of delete order)
const RESTORE_ORDER = [
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
  "course_registrations",
  "exam_attempts",
  "exam_answers",
  "wsf_attendance_reports",
  "wsf_attendance",
  "unit_leader_assignments",
  "audit_log",
];

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
      return new Response(JSON.stringify({ error: "Only super admins can restore data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { archive_id } = await req.json();

    if (!archive_id) {
      return new Response(JSON.stringify({ error: "archive_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the archive
    const { data: archive, error: archiveError } = await adminClient
      .from("purged_data_archives")
      .select("*")
      .eq("id", archive_id)
      .single();

    if (archiveError || !archive) {
      return new Response(JSON.stringify({ error: "Archive not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (archive.status !== "archived") {
      return new Response(JSON.stringify({ error: `Archive status is '${archive.status}', cannot restore` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to the tenant
    const { data: belongsToTenant } = await adminClient.rpc("user_belongs_to_tenant", {
      _user_id: user.id,
      _tenant_id: archive.tenant_id,
    });

    if (!belongsToTenant) {
      return new Response(JSON.stringify({ error: "You do not belong to this tenant" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check expiry
    if (new Date(archive.expires_at) < new Date()) {
      return new Response(JSON.stringify({ error: "This archive has expired and can no longer be restored" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = archive.data as Record<string, unknown[]>;
    const restoreErrors: string[] = [];

    // Restore data in FK-safe order
    for (const table of RESTORE_ORDER) {
      const rows = data[table];
      if (!rows || rows.length === 0) continue;

      try {
        // Insert in batches of 500 to avoid payload limits
        for (let i = 0; i < rows.length; i += 500) {
          const batch = rows.slice(i, i + 500);
          const { error } = await adminClient.from(table).insert(batch);
          if (error) {
            console.error(`Error restoring ${table}:`, error.message);
            restoreErrors.push(`${table}: ${error.message}`);
          }
        }
      } catch (e) {
        console.error(`Error restoring ${table}:`, e);
        restoreErrors.push(`${table}: ${String(e)}`);
      }
    }

    // Also restore profiles and user_roles if archived
    if (data["profiles"] && (data["profiles"] as unknown[]).length > 0) {
      try {
        const { error } = await adminClient.from("profiles").insert(data["profiles"]);
        if (error) restoreErrors.push(`profiles: ${error.message}`);
      } catch (e) {
        restoreErrors.push(`profiles: ${String(e)}`);
      }
    }

    if (data["user_roles"] && (data["user_roles"] as unknown[]).length > 0) {
      try {
        const { error } = await adminClient.from("user_roles").insert(data["user_roles"]);
        if (error) restoreErrors.push(`user_roles: ${error.message}`);
      } catch (e) {
        restoreErrors.push(`user_roles: ${String(e)}`);
      }
    }

    // Mark archive as restored
    await adminClient
      .from("purged_data_archives")
      .update({ status: "restored" })
      .eq("id", archive_id);

    await writeAudit(adminClient, {
      tenant_id: null,
      user_id: user?.id ?? null,
      action: "data_restore",
      entity_type: "purged_data_archives",
      entity_id: archive_id,
      details: { warnings_count: restoreErrors.length, source: "restore-purged-data" },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: "Data has been restored successfully.",
        warnings: restoreErrors.length > 0 ? restoreErrors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Restore error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred during restore." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
