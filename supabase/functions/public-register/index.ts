import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Simple in-memory rate limiter (per isolate — resets on cold start, but still effective)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function isRateLimited(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  entry.count++;
  return entry.count > RATE_LIMIT;
}

function sanitize(val: unknown, maxLen: number): string | null {
  if (val === null || val === undefined || val === "") return null;
  const s = String(val).trim().slice(0, maxLen);
  return s.replace(/<[^>]*>/g, "");
}

function validateEmail(email: string | null): boolean {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function validatePhone(phone: string | null): boolean {
  if (!phone) return true;
  return /^[\d\s\+\-\(\)]{5,20}$/.test(phone);
}

async function getAuthenticatedUser(req: Request, supabaseUrl: string, anonKey: string) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;

  const token = authHeader.replace("Bearer ", "");
  const authClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: { user }, error } = await authClient.auth.getUser(token);
  if (error || !user) return null;

  return {
    userId: user.id,
    email: typeof user.email === "string" ? user.email.toLowerCase() : null,
  };
}

function triggerWelcomeEmail(email: string, firstName: string | null, lastName: string | null, tenantId?: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ email, first_name: firstName, last_name: lastName, ...(tenantId ? { tenant_id: tenantId } : {}) }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "no body");
        console.error(`Welcome email trigger failed: ${res.status} ${res.statusText}`, body);
      } else {
        console.log("Welcome email triggered successfully for", email);
      }
    })
    .catch((err) => console.error("Welcome email trigger network error:", err));
}

async function createPastoralCareForPrayerRequest(
  supabase: any,
  memberId: string,
  firstName: string,
  lastName: string,
  notes: string,
  tenantId: string | null,
) {
  try {
    // Find Pastoral Care unit leaders using round-robin (tenant-scoped)
    let leadersQuery = supabase
      .from("unit_leader_assignments")
      .select("user_id")
      .in("unit_name", ["Pastoral Care", "Pastoral care", "pastoral care"]);
    if (tenantId) leadersQuery = leadersQuery.eq("tenant_id", tenantId);
    const { data: pcMembers } = await leadersQuery;

    let assignedTo: string | null = null;
    if (pcMembers && pcMembers.length > 0) {
      // Least-busy assignment
      let countsQuery = supabase
        .from("pastoral_care")
        .select("assigned_to")
        .in("status", ["Open", "In Progress"])
        .in("assigned_to", pcMembers.map((m: any) => m.user_id));
      if (tenantId) countsQuery = countsQuery.eq("tenant_id", tenantId);
      const { data: counts } = await countsQuery;

      const countMap: Record<string, number> = {};
      pcMembers.forEach((m: any) => { countMap[m.user_id] = 0; });
      (counts || []).forEach((c: any) => {
        if (c.assigned_to) countMap[c.assigned_to] = (countMap[c.assigned_to] || 0) + 1;
      });

      const sorted = Object.entries(countMap).sort((a, b) => a[1] - b[1]);
      assignedTo = sorted[0]?.[0] || null;
    }

    await supabase.from("pastoral_care").insert({
      member_id: memberId,
      care_type: "Prayer Request",
      subject: `Prayer Request from ${firstName} ${lastName}`,
      description: notes,
      status: "Open",
      assigned_to: assignedTo,
      confidential: false,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    });

    console.log("Pastoral care record created for prayer request from", firstName, lastName);
  } catch (err) {
    console.error("Failed to create pastoral care for prayer request:", err);
  }
}


async function queueJoinRequests(
  supabase: any,
  memberId: string,
  tenantId: string | null,
  churchUnit: string | null,
  wsfCentreId: string | null,
  requestedBy: string | null,
) {
  if (!memberId || !tenantId) return;
  const inserted: Array<{ id: string; request_type: "unit" | "home_cell"; unit_name: string | null; wsf_centre_id: string | null }> = [];
  try {
    const unitNames = (churchUnit || "")
      .split(",")
      .map((s: string) => s.trim())
      .filter((s: string) => s && s.toLowerCase() !== "none");

    for (const unit_name of unitNames) {
      // Skip if a pending or approved request already exists
      const { data: existing } = await supabase
        .from("unit_join_requests")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("member_id", memberId)
        .eq("request_type", "unit")
        .ilike("unit_name", unit_name)
        .in("status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();
      if (existing) continue;

      const { data: row, error } = await supabase
        .from("unit_join_requests")
        .insert({
          tenant_id: tenantId,
          member_id: memberId,
          request_type: "unit",
          unit_name,
          requested_by: requestedBy,
          status: "pending",
        })
        .select("id")
        .single();
      if (!error && row) inserted.push({ id: row.id, request_type: "unit", unit_name, wsf_centre_id: null });
    }

    if (wsfCentreId) {
      const { data: existing } = await supabase
        .from("unit_join_requests")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("member_id", memberId)
        .eq("request_type", "home_cell")
        .eq("wsf_centre_id", wsfCentreId)
        .in("status", ["pending", "approved"])
        .limit(1)
        .maybeSingle();
      if (!existing) {
        const { data: row, error } = await supabase
          .from("unit_join_requests")
          .insert({
            tenant_id: tenantId,
            member_id: memberId,
            request_type: "home_cell",
            wsf_centre_id: wsfCentreId,
            requested_by: requestedBy,
            status: "pending",
          })
          .select("id")
          .single();
        if (!error && row) inserted.push({ id: row.id, request_type: "home_cell", unit_name: null, wsf_centre_id: wsfCentreId });
      }
    }

    // Fire-and-forget notify per request
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    for (const r of inserted) {
      fetch(`${supabaseUrl}/functions/v1/notify-join-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({
          request_id: r.id,
          tenant_id: tenantId,
          member_id: memberId,
          request_type: r.request_type,
          unit_name: r.unit_name,
          wsf_centre_id: r.wsf_centre_id,
        }),
      }).catch((err) => console.error("notify-join-request error:", err));
    }
  } catch (err) {
    console.error("Failed to queue join requests:", err);
  }
}

async function ensureTenantAccess(supabase: any, userId: string | null | undefined, tenantId: string | null | undefined) {
  if (!userId || !tenantId) return;
  try {
    await supabase.from("tenant_memberships").upsert(
      { user_id: userId, tenant_id: tenantId, role: "member" },
      { onConflict: "user_id,tenant_id" }
    );
    await supabase.from("user_roles").upsert(
      { user_id: userId, role: "member", tenant_id: tenantId },
      { onConflict: "user_id,role,tenant_id" }
    );

    // Fix profile tenant if it defaulted to Demo Church but user registered at a real tenant
    const DEFAULT_TENANT_ID = "d8bbbdae-d9b3-4999-912d-3aa5999884b0";
    if (tenantId !== DEFAULT_TENANT_ID) {
      await supabase
        .from("profiles")
        .update({ tenant_id: tenantId })
        .eq("user_id", userId)
        .eq("tenant_id", DEFAULT_TENANT_ID);
    }
  } catch (err) {
    console.error("Failed to ensure tenant access:", err);
  }
}

const VALID_STATUSES = ["First Timer", "New Convert", "Active", "Inactive", "Visitor"];
const VALID_GENDERS = ["Male", "Female"];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authenticatedUser = await getAuthenticatedUser(req, supabaseUrl, anonKey);

    const body = await req.json();
    let resolvedTenantId = sanitize(body.tenant_id, 36);

    // Fallback: resolve tenant from slug if tenant_id is missing
    if (!resolvedTenantId && body.tenant_slug) {
      const slug = sanitize(body.tenant_slug, 100);
      if (slug) {
        const { data: tenantBySlug } = await supabase
          .from("tenants")
          .select("id")
          .eq("slug", slug)
          .eq("is_archived", false)
          .maybeSingle();
        if (tenantBySlug) resolvedTenantId = tenantBySlug.id;
      }
    }

    // Reject registrations that cannot be scoped to a real tenant — never silently default.
    if (!resolvedTenantId) {
      return new Response(
        JSON.stringify({ error: "Missing tenant context. This registration link is invalid." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = resolvedTenantId;

    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many registrations. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // body already parsed above

    // Honeypot check — if filled, silently succeed (bot trap)
    if (body.website) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const firstName = sanitize(body.first_name, 100);
    const lastName = sanitize(body.last_name, 100);
    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "First and last name are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (body.gdpr_consent !== true) {
      return new Response(JSON.stringify({ error: "GDPR consent is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = sanitize(body.email, 255)?.toLowerCase() ?? null;
    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = sanitize(body.phone, 20);
    if (!validatePhone(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const membershipStatus = VALID_STATUSES.includes(body.membership_status)
      ? body.membership_status
      : "First Timer";

    const gender = VALID_GENDERS.includes(body.gender) ? body.gender : null;

    const address = sanitize(body.address, 300);
    const city = sanitize(body.city, 100);
    const postcode = sanitize(body.postcode, 20);
    const dateOfBirth = sanitize(body.date_of_birth, 10);
    const churchUnit = sanitize(body.church_unit, 500);
    const notes = sanitize(body.notes, 2000);
    const emergencyContactName = sanitize(body.emergency_contact_name, 100);
    const emergencyContactPhone = sanitize(body.emergency_contact_phone, 20);
    const wsfCentreId = sanitize(body.wsf_centre_id, 36);

    const waterBaptism = body.water_baptism === true;
    const holySpiritBaptism = body.holy_spirit_baptism === true;
    const winnersSatellite = body.winners_satellite === true;
    const bfcCompleted = body.bfc_completed === true;
    const bccCompleted = body.bcc_completed === true;
    const lccCompleted = body.lcc_completed === true;
    const ldcCompleted = body.ldc_completed === true;

    // Welcome question fields (First Timer / New Convert)
    const worshippedBefore = body.worshipped_before === true ? true : (body.worshipped_before === false ? false : null);
    const worshippedWhenWhere = sanitize(body.worshipped_when_where, 500);
    const wouldLikeToJoin = body.would_like_to_join === true ? true : (body.would_like_to_join === false ? false : null);
    const liveWorkInCity = body.live_work_in_city === true ? true : (body.live_work_in_city === false ? false : null);
    const howDidYouHear = sanitize(body.how_did_you_hear, 300);
    const attendedFoundationSchool = body.attended_foundation_school === true ? true : (body.attended_foundation_school === false ? false : null);
    const wofbiHighestLevel = sanitize(body.wofbi_highest_level, 50);
    const baptizedByImmersion = body.baptized_by_immersion === true ? true : (body.baptized_by_immersion === false ? false : null);
    const preferredContactModes = sanitize(body.preferred_contact_modes, 200);
    const worshippedAtOtherWci = body.worshipped_at_other_wci === true ? true : (body.worshipped_at_other_wci === false ? false : null);

    if (wsfCentreId) {
      const { data: centre } = await supabase
        .from("wsf_centres")
        .select("id")
        .eq("id", wsfCentreId)
        .eq("is_active", true)
        .maybeSingle();

      if (!centre) {
        return new Response(JSON.stringify({ error: "Invalid WSF centre." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // tenantId already parsed above

    const memberPayload = {
      first_name: firstName,
      last_name: lastName,
      email,
      phone,
      address,
      city,
      postcode,
      date_of_birth: dateOfBirth || null,
      gender,
      membership_status: membershipStatus,
      // church_unit and wsf_centre_id are routed through unit_join_requests (leader approval)
      church_unit: null,
      notes,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      water_baptism: waterBaptism,
      holy_spirit_baptism: holySpiritBaptism,
      // winners_satellite is set when a home_cell request is approved
      winners_satellite: false,
      wsf_centre_id: null,
      bfc_completed: bfcCompleted,
      bcc_completed: bccCompleted,
      lcc_completed: lccCompleted,
      ldc_completed: ldcCompleted,
      gdpr_consent: true,
      gdpr_consent_date: new Date().toISOString(),
      // Welcome question fields
      worshipped_before: worshippedBefore,
      worshipped_when_where: worshippedWhenWhere,
      would_like_to_join: wouldLikeToJoin,
      live_work_in_city: liveWorkInCity,
      how_did_you_hear: howDidYouHear,
      attended_foundation_school: attendedFoundationSchool,
      wofbi_highest_level: wofbiHighestLevel,
      baptized_by_immersion: baptizedByImmersion,
      preferred_contact_modes: preferredContactModes,
      worshipped_at_other_wci: worshippedAtOtherWci,
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    // Requested unit/centre selections (queued as pending join requests after member is upserted)
    const requestedChurchUnit = churchUnit;
    const requestedWsfCentreId = winnersSatellite ? (wsfCentreId || null) : null;

    let resultMemberId: string | null = null;
    let resultMode = "created";

    // SECURITY: Only link a member row to the authenticated user when the form's
    // email matches the auth user's email. This prevents admins/leaders who are
    // logged in and registering someone else from having that new member row
    // stamped with their own user_id (which would let them see and act as the
    // other person).
    const isSelfRegistration =
      !!authenticatedUser?.userId &&
      !!email &&
      !!authenticatedUser?.email &&
      email.trim().toLowerCase() === authenticatedUser.email.trim().toLowerCase();

    if (authenticatedUser?.userId && !isSelfRegistration) {
      console.warn("public-register: skipping user_id stamp — form email does not match auth user", {
        authEmail: authenticatedUser.email,
        formEmail: email,
      });
    }

    if (isSelfRegistration) {

      let linkedMemberQuery = supabase
        .from("members")
        .select("id")
        .eq("user_id", authenticatedUser.userId);
      if (tenantId) linkedMemberQuery = linkedMemberQuery.eq("tenant_id", tenantId);
      const { data: linkedMember, error: linkedMemberError } = await linkedMemberQuery
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (linkedMemberError) throw linkedMemberError;

      if (linkedMember) {
        const { error: updateError } = await supabase
          .from("members")
          .update(memberPayload)
          .eq("id", linkedMember.id);

        if (updateError) throw updateError;
        resultMemberId = linkedMember.id;
        resultMode = "updated";

        // Ensure tenant access rows exist
        await ensureTenantAccess(supabase, authenticatedUser.userId, tenantId || memberPayload.tenant_id);

        if (email) triggerWelcomeEmail(email, firstName, lastName, tenantId);

        // Prayer request routing
        if (notes && notes.trim()) {
          createPastoralCareForPrayerRequest(supabase, linkedMember.id, firstName, lastName, notes, tenantId);
        }

        // Queue unit/centre selections as pending join requests (leader approval)
        await queueJoinRequests(supabase, linkedMember.id, tenantId, requestedChurchUnit, requestedWsfCentreId, authenticatedUser.userId);

        return new Response(JSON.stringify({ success: true, mode: resultMode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const candidateEmails = [...new Set([email, authenticatedUser.email].filter(Boolean))];
      for (const candidateEmail of candidateEmails) {
        let emailQuery = supabase
          .from("members")
          .select("id, user_id")
          .eq("email", candidateEmail);
        if (tenantId) emailQuery = emailQuery.eq("tenant_id", tenantId);
        const { data: emailMatches, error: emailMatchError } = await emailQuery
          .order("created_at", { ascending: false })
          .limit(2);

        if (emailMatchError) throw emailMatchError;

        if (emailMatches.length === 1 && (!emailMatches[0].user_id || emailMatches[0].user_id === authenticatedUser.userId)) {
          // Verify the auth user actually exists before writing user_id (prevents FK violation)
          const { data: verifiedUser, error: verifyErr } = await supabase.auth.admin.getUserById(authenticatedUser.userId);
          if (verifyErr || !verifiedUser?.user) {
            console.error("Auth user verification failed during claim:", verifyErr?.message);
            // Skip claim — just insert as new member without user_id
            break;
          }

          const { error: claimUpdateError } = await supabase
            .from("members")
            .update({ ...memberPayload, user_id: authenticatedUser.userId })
            .eq("id", emailMatches[0].id);

          if (claimUpdateError) throw claimUpdateError;
          resultMemberId = emailMatches[0].id;

          // Ensure tenant access rows exist
          await ensureTenantAccess(supabase, authenticatedUser.userId, tenantId || memberPayload.tenant_id);

          if (email) triggerWelcomeEmail(email, firstName, lastName, tenantId);

          // Prayer request routing
          if (notes && notes.trim()) {
            createPastoralCareForPrayerRequest(supabase, emailMatches[0].id, firstName, lastName, notes, tenantId);
          }

          await queueJoinRequests(supabase, emailMatches[0].id, tenantId, requestedChurchUnit, requestedWsfCentreId, authenticatedUser.userId);

          return new Response(JSON.stringify({ success: true, mode: "claimed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    // Verify auth user exists before writing user_id to prevent FK violation
    let verifiedUserId: string | null = null;
    let verifiedUserId: string | null = null;
    if (isSelfRegistration && authenticatedUser?.userId) {

      const { data: verifiedUser, error: verifyErr } = await supabase.auth.admin.getUserById(authenticatedUser.userId);
      if (!verifyErr && verifiedUser?.user) {
        verifiedUserId = authenticatedUser.userId;
      } else {
        console.warn("Auth user not found for insert, skipping user_id:", authenticatedUser.userId);
      }
    }

    // Check for existing member by email (prevents duplicates from double-submit)
    if (email) {
      let dupeQuery = supabase.from("members").select("id").eq("email", email);
      if (tenantId) dupeQuery = dupeQuery.eq("tenant_id", tenantId);
      const { data: existingByEmail } = await dupeQuery.limit(1).maybeSingle();

      if (existingByEmail) {
        // Update existing record instead of creating duplicate
        await supabase.from("members").update(memberPayload).eq("id", existingByEmail.id);
        resultMemberId = existingByEmail.id;
        resultMode = "updated";
        if (email) triggerWelcomeEmail(email, firstName, lastName, tenantId);

        // Prayer request → pastoral care
        if (notes && notes.trim()) {
          createPastoralCareForPrayerRequest(supabase, existingByEmail.id, firstName, lastName, notes, tenantId);
        }

        await queueJoinRequests(supabase, existingByEmail.id, tenantId, requestedChurchUnit, requestedWsfCentreId, verifiedUserId);

        return new Response(JSON.stringify({ success: true, mode: resultMode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: insertedMember, error: memberError } = await supabase
      .from("members")
      .insert({
        ...memberPayload,
        user_id: verifiedUserId,
      })
      .select("id")
      .single();

    if (memberError) throw memberError;
    resultMemberId = insertedMember?.id || null;

    // Ensure tenant access rows exist for authenticated users
    await ensureTenantAccess(supabase, authenticatedUser?.userId, tenantId || memberPayload.tenant_id);

    // Fire-and-forget welcome email
    if (email) {
      triggerWelcomeEmail(email, firstName, lastName, tenantId);
    }

    // Prayer request → pastoral care
    if (notes && notes.trim() && resultMemberId) {
      createPastoralCareForPrayerRequest(supabase, resultMemberId, firstName, lastName, notes, tenantId);
    }

    if (resultMemberId) {
      await queueJoinRequests(supabase, resultMemberId, tenantId, requestedChurchUnit, requestedWsfCentreId, verifiedUserId);
    }

    return new Response(JSON.stringify({ success: true, mode: "created" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Registration error:", err);
    return new Response(JSON.stringify({ error: "Registration failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
