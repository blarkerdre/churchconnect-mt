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

    // 3. Re-authenticate with password
    const { password } = await req.json();
    if (!password) {
      return new Response(
        JSON.stringify({ error: "Password is required for re-authentication" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { error: signInError } =
      await adminClient.auth.signInWithPassword({
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

    // 4. Delete transactional data in FK-safe order using service role client
    // Child tables first, then parent tables

    // Exam related (child first)
    await adminClient.from("exam_answers").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("exam_attempts").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("course_registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Attendance
    await adminClient.from("attendance_records").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("attendance_sessions").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // WSF attendance
    await adminClient.from("wsf_attendance").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("wsf_attendance_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Follow-ups & pastoral care
    await adminClient.from("followups").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("pastoral_care").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Events
    await adminClient.from("event_registrations").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("events").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Communications
    await adminClient.from("announcements").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("messages").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("notifications").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("sms_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("email_send_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Transportation
    await adminClient.from("transportation").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Documents
    await adminClient.from("documents").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // First timers
    await adminClient.from("first_timers").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Member status history
    await adminClient.from("member_status_history").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Training
    await adminClient.from("training_completions").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("training_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");
    await adminClient.from("church_attendance_reports").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Audit log
    await adminClient.from("audit_log").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Suppressed emails
    await adminClient.from("suppressed_emails").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Members (preserve none - all member records go)
    await adminClient.from("members").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // User roles (keep acting super admin's role)
    await adminClient.from("user_roles").delete().neq("user_id", actingUserId);

    // Unit leader assignments
    await adminClient.from("unit_leader_assignments").delete().neq("id", "00000000-0000-0000-0000-000000000000");

    // Profiles (keep acting super admin's profile)
    await adminClient.from("profiles").delete().neq("user_id", actingUserId);

    // 5. Clear storage bucket files
    try {
      const { data: files } = await adminClient.storage
        .from("church-documents")
        .list("", { limit: 1000 });

      if (files && files.length > 0) {
        const filePaths = files.map((f) => f.name);
        await adminClient.storage.from("church-documents").remove(filePaths);
      }
    } catch (storageErr) {
      console.error("Storage cleanup error (non-fatal):", storageErr);
    }

    // 6. Delete other auth users (except acting super admin)
    const { data: { users: allUsers } } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
    if (allUsers) {
      for (const u of allUsers) {
        if (u.id !== actingUserId) {
          await adminClient.auth.admin.deleteUser(u.id);
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, message: "All data has been purged successfully." }),
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
