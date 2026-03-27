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

function triggerWelcomeEmail(email: string, firstName: string | null, lastName: string | null) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/send-welcome-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ email, first_name: firstName, last_name: lastName }),
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
) {
  try {
    // Find a Pastoral Care unit member using round-robin
    const { data: pcMembers } = await supabase
      .from("unit_leader_assignments")
      .select("user_id")
      .in("unit_name", ["Pastoral Care", "Pastoral care", "pastoral care"]);

    let assignedTo: string | null = null;
    if (pcMembers && pcMembers.length > 0) {
      // Least-busy assignment
      const { data: counts } = await supabase
        .from("pastoral_care")
        .select("assigned_to")
        .in("status", ["Open", "In Progress"])
        .in("assigned_to", pcMembers.map((m: any) => m.user_id));

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
    });

    console.log("Pastoral care record created for prayer request from", firstName, lastName);
  } catch (err) {
    console.error("Failed to create pastoral care for prayer request:", err);
  }
}

async function notifyWSFLeader(supabase: any, wsfCentreId: string, firstName: string, lastName: string) {
  try {
    const { data: centre } = await supabase
      .from("wsf_centres")
      .select("leader_id, name")
      .eq("id", wsfCentreId)
      .maybeSingle();

    if (!centre?.leader_id) return;

    // Get the leader's user_id from members table
    const { data: leaderMember } = await supabase
      .from("members")
      .select("user_id")
      .eq("id", centre.leader_id)
      .maybeSingle();

    if (!leaderMember?.user_id) return;

    await supabase.from("notifications").insert({
      user_id: leaderMember.user_id,
      title: "New Member Registration",
      message: `${firstName} ${lastName} registered near your WSF centre: ${centre.name}`,
      type: "general",
      reference_type: "wsf_centre",
      reference_id: wsfCentreId,
    });

    console.log("WSF leader notified for new registration near", centre.name);
  } catch (err) {
    console.error("Failed to notify WSF leader:", err);
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
      { onConflict: "user_id,role" }
    );
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
    const tenantId = sanitize(body.tenant_id, 36);

    // Authenticated users MUST have a tenant context to prevent orphaned records
    if (authenticatedUser?.userId && !tenantId) {
      return new Response(JSON.stringify({ error: "Tenant context is required. Please access your profile through your church portal." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      church_unit: churchUnit,
      notes,
      emergency_contact_name: emergencyContactName,
      emergency_contact_phone: emergencyContactPhone,
      water_baptism: waterBaptism,
      holy_spirit_baptism: holySpiritBaptism,
      winners_satellite: winnersSatellite,
      wsf_centre_id: winnersSatellite ? (wsfCentreId || null) : null,
      bfc_completed: bfcCompleted,
      bcc_completed: bccCompleted,
      lcc_completed: lccCompleted,
      ldc_completed: ldcCompleted,
      gdpr_consent: true,
      gdpr_consent_date: new Date().toISOString(),
      ...(tenantId ? { tenant_id: tenantId } : {}),
    };

    let resultMemberId: string | null = null;
    let resultMode = "created";

    if (authenticatedUser?.userId) {
      const { data: linkedMember, error: linkedMemberError } = await supabase
        .from("members")
        .select("id")
        .eq("user_id", authenticatedUser.userId)
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

        if (email) triggerWelcomeEmail(email, firstName, lastName);

        // Prayer request routing
        if (notes && notes.trim()) {
          createPastoralCareForPrayerRequest(supabase, linkedMember.id, firstName, lastName, notes);
        }

        // WSF leader notification
        const effectiveWsfCentreId = winnersSatellite ? (wsfCentreId || null) : null;
        if (effectiveWsfCentreId) {
          notifyWSFLeader(supabase, effectiveWsfCentreId, firstName, lastName);
        }

        return new Response(JSON.stringify({ success: true, mode: resultMode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const candidateEmails = [...new Set([email, authenticatedUser.email].filter(Boolean))];
      for (const candidateEmail of candidateEmails) {
        const { data: emailMatches, error: emailMatchError } = await supabase
          .from("members")
          .select("id, user_id")
          .eq("email", candidateEmail)
          .order("created_at", { ascending: false })
          .limit(2);

        if (emailMatchError) throw emailMatchError;

        if (emailMatches.length === 1 && (!emailMatches[0].user_id || emailMatches[0].user_id === authenticatedUser.userId)) {
          const { error: claimUpdateError } = await supabase
            .from("members")
            .update({ ...memberPayload, user_id: authenticatedUser.userId })
            .eq("id", emailMatches[0].id);

          if (claimUpdateError) throw claimUpdateError;
          resultMemberId = emailMatches[0].id;

          // Ensure tenant access rows exist
          await ensureTenantAccess(supabase, authenticatedUser.userId, tenantId || memberPayload.tenant_id);

          if (email) triggerWelcomeEmail(email, firstName, lastName);

          // Prayer request routing
          if (notes && notes.trim()) {
            createPastoralCareForPrayerRequest(supabase, emailMatches[0].id, firstName, lastName, notes);
          }

          // WSF leader notification
          const effectiveWsfCentreId = winnersSatellite ? (wsfCentreId || null) : null;
          if (effectiveWsfCentreId) {
            notifyWSFLeader(supabase, effectiveWsfCentreId, firstName, lastName);
          }

          return new Response(JSON.stringify({ success: true, mode: "claimed" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    const { data: insertedMember, error: memberError } = await supabase
      .from("members")
      .insert({
        ...memberPayload,
        user_id: authenticatedUser?.userId ?? null,
      })
      .select("id")
      .single();

    if (memberError) throw memberError;
    resultMemberId = insertedMember?.id || null;

    // Ensure tenant access rows exist for authenticated users
    await ensureTenantAccess(supabase, authenticatedUser?.userId, tenantId || memberPayload.tenant_id);

    // Fire-and-forget welcome email
    if (email) {
      triggerWelcomeEmail(email, firstName, lastName);
    }

    // Prayer request → pastoral care
    if (notes && notes.trim() && resultMemberId) {
      createPastoralCareForPrayerRequest(supabase, resultMemberId, firstName, lastName, notes);
    }

    // WSF leader notification
    const effectiveWsfCentreId = winnersSatellite ? (wsfCentreId || null) : null;
    if (effectiveWsfCentreId) {
      notifyWSFLeader(supabase, effectiveWsfCentreId, firstName, lastName);
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
