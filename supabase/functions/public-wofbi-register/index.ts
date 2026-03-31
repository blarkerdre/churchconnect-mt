import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TENANT_ID = "d8bbbdae-d9b3-4999-912d-3aa5999884b0";

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

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
  if (!email) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 255;
}

function validatePhone(phone: string | null): boolean {
  if (!phone) return true;
  return /^[\d\s\+\-\(\)]{5,20}$/.test(phone);
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
        console.error(`Welcome email trigger failed: ${res.status}`, body);
      }
    })
    .catch((err) => console.error("Welcome email trigger error:", err));
}

function triggerCourseRegistrationEmail(email: string, firstName: string | null, courseName: string) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  fetch(`${supabaseUrl}/functions/v1/send-course-registration-email`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceRoleKey}`,
    },
    body: JSON.stringify({ email, first_name: firstName, course_name: courseName }),
  })
    .then(async (res) => {
      if (!res.ok) {
        const body = await res.text().catch(() => "no body");
        console.error(`Course registration email trigger failed: ${res.status}`, body);
      }
    })
    .catch((err) => console.error("Course registration email trigger error:", err));
}

async function resolveTenantId(
  supabase: ReturnType<typeof createClient>,
  bodyTenantId: string | null,
  bodyTenantSlug: string | null
): Promise<string> {
  // 1. Direct tenant_id from body
  if (bodyTenantId) return bodyTenantId;

  // 2. Resolve from slug
  if (bodyTenantSlug) {
    const { data } = await supabase.rpc("get_tenant_by_slug", { _slug: bodyTenantSlug });
    const row = Array.isArray(data) ? data[0] : data;
    if (row?.id) return row.id;
  }

  // 3. Fallback
  return DEFAULT_TENANT_ID;
}

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

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Rate limiting
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many registrations. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Honeypot
    if (body.website) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tenant
    const tenantId = await resolveTenantId(
      supabase,
      sanitize(body.tenant_id, 36),
      sanitize(body.tenant_slug, 100)
    );

    const firstName = sanitize(body.first_name, 100);
    const lastName = sanitize(body.last_name, 100);
    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "First and last name are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const email = sanitize(body.email, 255)?.toLowerCase() ?? null;
    if (!validateEmail(email)) {
      return new Response(JSON.stringify({ error: "A valid email is required." }), {
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

    const phone = sanitize(body.phone, 20);
    if (!validatePhone(phone)) {
      return new Response(JSON.stringify({ error: "Invalid phone format." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const courseId = sanitize(body.course_id, 36);
    if (!courseId) {
      return new Response(JSON.stringify({ error: "Please select a course." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify course exists, is active, open, and belongs to tenant
    const { data: course, error: courseError } = await supabase
      .from("exam_titles")
      .select("id, name, registration_open, is_active")
      .eq("id", courseId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (courseError) throw courseError;

    if (!course || !course.is_active || !course.registration_open) {
      return new Response(JSON.stringify({ error: "This course is not currently accepting registrations." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Find or create member by email — scoped to tenant
    let memberId: string | null = null;
    let isNewMember = false;

    const { data: existingMember } = await supabase
      .from("members")
      .select("id")
      .eq("email", email)
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingMember) {
      memberId = existingMember.id;
    } else {
      const { data: newMember, error: insertError } = await supabase
        .from("members")
        .insert({
          first_name: firstName,
          last_name: lastName,
          email,
          phone,
          membership_status: "First Timer",
          gdpr_consent: true,
          gdpr_consent_date: new Date().toISOString(),
          tenant_id: tenantId,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;
      memberId = newMember.id;
      isNewMember = true;
    }

    // Check for duplicate registration
    const { data: existingReg } = await supabase
      .from("course_registrations")
      .select("id")
      .eq("member_id", memberId)
      .eq("course_id", courseId)
      .maybeSingle();

    if (existingReg) {
      return new Response(JSON.stringify({ error: "You are already registered for this course." }), {
        status: 409,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Insert course registration with tenant_id
    const { error: regError } = await supabase
      .from("course_registrations")
      .insert({ member_id: memberId, course_id: courseId, tenant_id: tenantId });

    if (regError) throw regError;

    // Fire-and-forget welcome email for new members
    if (isNewMember && email) {
      triggerWelcomeEmail(email, firstName, lastName);
    }

    // Fire-and-forget course registration confirmation email
    if (email) {
      triggerCourseRegistrationEmail(email, firstName, course.name);
    }

    return new Response(JSON.stringify({ success: true, course_name: course.name }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("WoFBI registration error:", err);
    return new Response(JSON.stringify({ error: "Registration failed. Please try again." }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
