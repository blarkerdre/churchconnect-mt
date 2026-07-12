import { createClient } from "npm:@supabase/supabase-js@2";
import { writeAudit } from "../_shared/audit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { request_id } = await req.json();
    if (!request_id) {
      return new Response(JSON.stringify({ error: "request_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: request, error: reqErr } = await admin.from("erasure_requests")
      .select("*").eq("id", request_id).single();
    if (reqErr || !request) {
      return new Response(JSON.stringify({ error: "Request not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Caller must be tenant admin
    const { data: isAdmin } = await admin.rpc("is_admin", {
      _user_id: user.id, _tenant_id: request.tenant_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    if (request.status !== "approved") {
      return new Response(JSON.stringify({ error: "Request must be approved first" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const tenantId = request.tenant_id;
    const memberId = request.member_id;
    const subjectUserId = request.user_id;

    // Snapshot member row + related for recovery
    const snapshot: Record<string, unknown[]> = {};
    if (memberId) {
      const { data: m } = await admin.from("members").select("*").eq("id", memberId);
      snapshot["members"] = m || [];
      for (const t of ["sermon_notes", "testimonies", "app_feedback", "push_subscriptions",
                       "life_event_requests", "consent_events"]) {
        try {
          const { data } = await admin.from(t).select("*").eq("user_id", subjectUserId);
          if (data) snapshot[t] = data;
        } catch { /* ignore */ }
      }
    }

    let archiveId: string | null = null;
    if (Object.keys(snapshot).length > 0) {
      const { data: arch } = await admin.from("purged_data_archives").insert({
        tenant_id: tenantId, purged_by: user.id, data: snapshot,
      }).select("id").single();
      archiveId = arch?.id ?? null;
    }

    // Anonymise members row (preserves referential integrity for shared stats)
    if (memberId) {
      await admin.from("members").update({
        first_name: "Erased",
        last_name: "Member",
        email: null,
        phone: null,
        date_of_birth: null,
        address: null,
        postcode: null,
        notes: null,
        photo_url: null,
        emergency_contact_name: null,
        emergency_contact_phone: null,
        preferred_contact_modes: null,
        worshipped_when_where: null,
        how_did_you_hear: null,
        user_id: null,
        consent_marketing: false,
        consent_photos: false,
        consent_pastoral_contact: false,
        consent_third_party_sharing: false,
      }).eq("id", memberId);
    }

    // Delete personal artefacts (belong solely to the individual)
    if (subjectUserId) {
      for (const t of ["sermon_notes", "sermon_note_folders", "testimonies",
                       "app_feedback", "push_subscriptions", "user_tour_completions"]) {
        try { await admin.from(t).delete().eq("user_id", subjectUserId); } catch { /* ignore */ }
      }

      // Remove tenant membership + roles scoped to this tenant
      await admin.from("tenant_memberships").delete()
        .eq("user_id", subjectUserId).eq("tenant_id", tenantId);

      // Delete auth user only if they have no other memberships
      const { data: others } = await admin.from("tenant_memberships")
        .select("id").eq("user_id", subjectUserId).limit(1);
      if (!others || others.length === 0) {
        try { await admin.auth.admin.deleteUser(subjectUserId); } catch (e) { console.error("deleteUser", e); }
      }
    }

    // Mark request completed
    await admin.from("erasure_requests").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      archive_id: archiveId,
    }).eq("id", request_id);

    await writeAudit(admin, {
      tenant_id: tenantId, user_id: user.id,
      action: "dsr_erasure_completed", entity_type: "erasure_request", entity_id: request_id,
      details: { archive_id: archiveId, subject_user_id: subjectUserId, member_id: memberId },
    });

    return new Response(JSON.stringify({
      success: true, archive_id: archiveId, recovery_days: 30,
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("process-erasure error:", err);
    return new Response(JSON.stringify({ error: "Erasure failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
