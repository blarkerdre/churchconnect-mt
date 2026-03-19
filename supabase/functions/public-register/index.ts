import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  // Strip HTML tags
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

const VALID_STATUSES = ["First Timer", "New Convert", "Active", "Inactive"];
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
    // Rate limiting by IP
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") || "unknown";
    if (isRateLimited(ip)) {
      return new Response(JSON.stringify({ error: "Too many registrations. Please try again later." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    // Honeypot check — if filled, silently succeed (bot trap)
    if (body.website) {
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Required fields
    const firstName = sanitize(body.first_name, 100);
    const lastName = sanitize(body.last_name, 100);
    if (!firstName || !lastName) {
      return new Response(JSON.stringify({ error: "First and last name are required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // GDPR consent
    if (body.gdpr_consent !== true) {
      return new Response(JSON.stringify({ error: "GDPR consent is required." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate fields
    const email = sanitize(body.email, 255);
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

    // Sanitize all remaining fields
    const address = sanitize(body.address, 300);
    const city = sanitize(body.city, 100);
    const postcode = sanitize(body.postcode, 20);
    const dateOfBirth = sanitize(body.date_of_birth, 10);
    const churchUnit = sanitize(body.church_unit, 500);
    const notes = sanitize(body.notes, 2000);
    const emergencyContactName = sanitize(body.emergency_contact_name, 100);
    const emergencyContactPhone = sanitize(body.emergency_contact_phone, 20);
    const wsfCentreId = sanitize(body.wsf_centre_id, 36);

    // Boolean fields
    const waterBaptism = body.water_baptism === true;
    const holySpiritBaptism = body.holy_spirit_baptism === true;
    const winnersSatellite = body.winners_satellite === true;
    const bfcCompleted = body.bfc_completed === true;
    const bccCompleted = body.bcc_completed === true;
    const lccCompleted = body.lcc_completed === true;
    const ldcCompleted = body.ldc_completed === true;

    // Use service role to insert (bypasses RLS)
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Validate wsf_centre_id exists if provided
    if (wsfCentreId) {
      const { data: centre } = await supabase
        .from("wsf_centres")
        .select("id")
        .eq("id", wsfCentreId)
        .eq("is_active", true)
        .single();
      if (!centre) {
        return new Response(JSON.stringify({ error: "Invalid WSF centre." }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Insert member
    const { data: member, error: memberError } = await supabase.from("members").insert({
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
      wsf_centre_id: wsfCentreId || null,
      bfc_completed: bfcCompleted,
      bcc_completed: bccCompleted,
      lcc_completed: lccCompleted,
      ldc_completed: ldcCompleted,
      gdpr_consent: true,
      gdpr_consent_date: new Date().toISOString(),
    }).select("id").single();

    if (memberError) throw memberError;

    // Follow-up is auto-created by the database trigger (auto_create_followup)
    // No manual insert needed — the trigger also handles notifications

    return new Response(JSON.stringify({ success: true }), {
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
