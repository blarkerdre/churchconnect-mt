// DomiFort → Church Management Suite bookings ingest
// Public webhook (verify_jwt=false). Auth: Authorization: Bearer <token> + X-CMS-Signature: HMAC-SHA256(body, signing_secret)
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cms-signature",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MAX_BODY_BYTES = 1_000_000; // 1 MB
const RATE_LIMIT = 60; // per token per minute
const RATE_WINDOW_MS = 60_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(key);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function extractBookings(parsed: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(parsed)) return parsed as Array<Record<string, unknown>>;
  if (parsed && typeof parsed === "object") {
    const obj = parsed as Record<string, unknown>;
    if (Array.isArray(obj.bookings)) return obj.bookings as Array<Record<string, unknown>>;
    return [obj];
  }
  return [];
}

function pickString(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v : null;
}

function pickNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() && !Number.isNaN(Number(v))) return Number(v);
  return null;
}

function pickTimestamp(v: unknown): string | null {
  const s = pickString(v);
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const ip = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || null;
  const userAgent = req.headers.get("user-agent") || null;

  let tokenId: string | null = null;
  let authValid = false;
  let signatureValid = false;
  let externalRefForLog: string | null = null;

  const log = async (status: number, error: string | null, payloadSize: number) => {
    try {
      await admin.from("domifort_ingest_log").insert({
        token_id: tokenId,
        auth_valid: authValid,
        signature_valid: signatureValid,
        status_code: status,
        external_ref: externalRefForLog,
        error,
        payload_size: payloadSize,
        ip,
        user_agent: userAgent,
      });
    } catch (e) {
      console.error("[domifort-ingest] Failed to write log:", e);
    }
  };

  try {
    // Read raw body (signature must be verified against raw bytes)
    const rawBody = await req.text();
    if (rawBody.length > MAX_BODY_BYTES) {
      await log(413, "Payload too large", rawBody.length);
      return new Response(JSON.stringify({ error: "Payload too large" }), {
        status: 413,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Bearer token
    const authHeader = req.headers.get("authorization") || "";
    const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!bearer) {
      await log(401, "Missing bearer token", rawBody.length);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tokenHash = await sha256Hex(bearer);

    const { data: tokenRow, error: tokenErr } = await admin
      .from("domifort_api_tokens")
      .select("id, signing_secret_hash, is_active")
      .eq("token_hash", tokenHash)
      .eq("is_active", true)
      .maybeSingle();

    if (tokenErr || !tokenRow) {
      await log(401, "Invalid token", rawBody.length);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    tokenId = tokenRow.id;
    authValid = true;

    if (!checkRateLimit(tokenId!)) {
      await log(429, "Rate limit exceeded", rawBody.length);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const providedSig = (req.headers.get("x-cms-signature") || "").trim().toLowerCase();
    if (!providedSig) {
      await log(401, "Missing X-CMS-Signature", rawBody.length);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const expectedSig = await hmacSha256Hex(tokenRow.signing_secret_hash, rawBody);
    if (!constantTimeEqual(providedSig, expectedSig)) {
      await log(401, "Invalid signature", rawBody.length);
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    signatureValid = true;

    // 3. Parse and validate body
    let parsed: unknown;
    try {
      parsed = JSON.parse(rawBody);
    } catch {
      await log(400, "Invalid JSON", rawBody.length);
      return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bookings = extractBookings(parsed);
    if (bookings.length === 0) {
      await log(400, "No bookings", rawBody.length);
      return new Response(JSON.stringify({ error: "No bookings provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (bookings.length > 500) {
      await log(400, "Too many bookings (max 500)", rawBody.length);
      return new Response(JSON.stringify({ error: "Too many bookings (max 500 per request)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve tenant slug → id once (cache)
    const slugCache = new Map<string, string | null>();
    async function resolveTenant(slugOrId: string | null): Promise<string | null> {
      if (!slugOrId) return null;
      if (slugCache.has(slugOrId)) return slugCache.get(slugOrId)!;
      // UUID match
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slugOrId)) {
        const { data } = await admin.from("tenants").select("id").eq("id", slugOrId).maybeSingle();
        const id = data?.id ?? null;
        slugCache.set(slugOrId, id);
        return id;
      }
      const { data } = await admin.from("tenants").select("id").eq("slug", slugOrId).maybeSingle();
      const id = data?.id ?? null;
      slugCache.set(slugOrId, id);
      return id;
    }

    const results: Array<{ external_ref: string; id?: string; action: string; error?: string }> = [];

    for (const b of bookings) {
      const externalRef = pickString(b.external_ref) || pickString(b.id) || pickString(b.booking_id);
      if (!externalRef) {
        results.push({ external_ref: "", action: "skipped", error: "Missing external_ref" });
        continue;
      }
      externalRefForLog = externalRef;

      const resolvedTenant = await resolveTenant(
        pickString(b.tenant_id) || pickString(b.tenant_slug) || pickString(b.church_slug),
      );

      const row = {
        external_ref: externalRef,
        status: pickString(b.status),
        customer_name: pickString(b.customer_name) || pickString(b.name),
        customer_email: pickString(b.customer_email) || pickString(b.email),
        customer_phone: pickString(b.customer_phone) || pickString(b.phone),
        service_type: pickString(b.service_type) || pickString(b.service),
        booking_start: pickTimestamp(b.booking_start) || pickTimestamp(b.start) || pickTimestamp(b.start_at),
        booking_end: pickTimestamp(b.booking_end) || pickTimestamp(b.end) || pickTimestamp(b.end_at),
        location: pickString(b.location),
        amount_minor: pickNumber(b.amount_minor) ?? (pickNumber(b.amount) !== null ? Math.round(pickNumber(b.amount)! * 100) : null),
        currency: pickString(b.currency)?.toUpperCase().slice(0, 3) ?? null,
        payload: b,
        tenant_id: resolvedTenant,
        source_token_id: tokenId,
      };

      const { data: upserted, error: upErr } = await admin
        .from("domifort_bookings")
        .upsert(row, { onConflict: "external_ref" })
        .select("id")
        .maybeSingle();

      if (upErr) {
        results.push({ external_ref: externalRef, action: "error", error: upErr.message });
      } else {
        results.push({ external_ref: externalRef, id: upserted?.id, action: "upserted" });
      }
    }

    // Update token usage stats (fire and forget)
    admin
      .from("domifort_api_tokens")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", tokenId!)
      .then(() => {});

    const okCount = results.filter((r) => r.action === "upserted").length;
    await log(200, null, rawBody.length);

    return new Response(
      JSON.stringify({ received: bookings.length, upserted: okCount, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[domifort-ingest] Error:", message);
    await log(500, message, 0);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
