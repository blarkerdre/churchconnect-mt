import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAudit } from "../_shared/audit.ts";;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Import order: parents first, then children
const IMPORT_ORDER = [
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
  "profiles",
  "user_roles",
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
      return new Response(JSON.stringify({ error: "Only super admins can import data" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { tenant_id, data } = await req.json();

    if (!tenant_id || !data) {
      return new Response(JSON.stringify({ error: "tenant_id and data are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user belongs to the tenant
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

    const importErrors: string[] = [];
    let totalImported = 0;

    // Import data in FK-safe order
    for (const table of IMPORT_ORDER) {
      const rows = data[table];
      if (!rows || rows.length === 0) continue;

      // Ensure tenant_id is set on each row
      const rowsWithTenant = rows.map((row: Record<string, unknown>) => ({
        ...row,
        tenant_id: row.tenant_id || tenant_id,
      }));

      try {
        // Insert in batches of 500 using upsert to handle duplicates gracefully
        for (let i = 0; i < rowsWithTenant.length; i += 500) {
          const batch = rowsWithTenant.slice(i, i + 500);
          const { error } = await adminClient
            .from(table)
            .upsert(batch, { onConflict: "id", ignoreDuplicates: true });
          if (error) {
            console.error(`Error importing ${table}:`, error.message);
            importErrors.push(`${table}: ${error.message}`);
          } else {
            totalImported += batch.length;
          }
        }
      } catch (e) {
        console.error(`Error importing ${table}:`, e);
        importErrors.push(`${table}: ${String(e)}`);
      }
    }

    await writeAudit(adminClient, {
      tenant_id,
      user_id: user?.id ?? null,
      action: "data_import",
      entity_type: "tenant",
      entity_id: tenant_id,
      details: {
        rows_imported: totalImported,
        warnings_count: importErrors.length,
        source: "import-tenant-data",
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Imported ${totalImported} records successfully.`,
        warnings: importErrors.length > 0 ? importErrors : undefined,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (err) {
    console.error("Import error:", err);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred during import." }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
