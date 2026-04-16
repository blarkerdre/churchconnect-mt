import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
};

const SENSITIVE_MEMBER_FIELDS = [
  "notes",
  "emergency_contact_name",
  "emergency_contact_phone",
  "address",
  "postcode",
];

// Simple in-memory rate limiter
const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(apiKey: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(apiKey);
  if (!entry || now > entry.resetAt) {
    rateLimits.set(apiKey, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }
  entry.count++;
  return entry.count <= RATE_LIMIT;
}

function stripSensitive(row: Record<string, unknown>): Record<string, unknown> {
  const cleaned = { ...row };
  for (const field of SENSITIVE_MEMBER_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Missing X-API-Key header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!checkRateLimit(apiKey)) {
      return new Response(JSON.stringify({ error: "Rate limit exceeded. Max 100 requests per minute." }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Validate API key
    const { data: keyRecord, error: keyError } = await adminClient
      .from("tenant_api_keys")
      .select("id, tenant_id")
      .eq("api_key", apiKey)
      .eq("is_active", true)
      .maybeSingle();

    if (keyError || !keyRecord) {
      return new Response(JSON.stringify({ error: "Invalid or inactive API key" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = keyRecord.tenant_id;

    // Update last_used_at (fire and forget)
    adminClient
      .from("tenant_api_keys")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", keyRecord.id)
      .then(() => {});

    const url = new URL(req.url);
    const resource = url.searchParams.get("resource");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 200);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    if (!resource) {
      return new Response(JSON.stringify({
        error: "Missing 'resource' query parameter",
        available_resources: ["members", "attendance_sessions", "attendance_records"],
      }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let responseData: unknown;

    switch (resource) {
      case "members": {
        const id = url.searchParams.get("id");
        if (id) {
          const { data, error } = await adminClient
            .from("members")
            .select("*")
            .eq("tenant_id", tenantId)
            .eq("id", id)
            .maybeSingle();
          if (error) throw error;
          responseData = { data: data ? stripSensitive(data) : null };
        } else {
          let query = adminClient
            .from("members")
            .select("*", { count: "exact" })
            .eq("tenant_id", tenantId)
            .range(offset, offset + limit - 1)
            .order("created_at", { ascending: false });

          const status = url.searchParams.get("status");
          if (status) query = query.eq("membership_status", status);

          const { data, error, count } = await query;
          if (error) throw error;
          responseData = {
            data: (data || []).map(stripSensitive),
            count: count || 0,
            limit,
            offset,
          };
        }
        break;
      }

      case "attendance_sessions": {
        let query = adminClient
          .from("attendance_sessions")
          .select("*", { count: "exact" })
          .eq("tenant_id", tenantId)
          .range(offset, offset + limit - 1)
          .order("session_date", { ascending: false });

        const from = url.searchParams.get("from");
        const to = url.searchParams.get("to");
        if (from) query = query.gte("session_date", from);
        if (to) query = query.lte("session_date", to);

        const { data, error, count } = await query;
        if (error) throw error;
        responseData = { data: data || [], count: count || 0, limit, offset };
        break;
      }

      case "attendance_records": {
        const sessionId = url.searchParams.get("session_id");
        if (!sessionId) {
          return new Response(JSON.stringify({ error: "session_id is required for attendance_records" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Verify session belongs to tenant
        const { data: session } = await adminClient
          .from("attendance_sessions")
          .select("id")
          .eq("id", sessionId)
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (!session) {
          return new Response(JSON.stringify({ error: "Session not found" }), {
            status: 404,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { data, error, count } = await adminClient
          .from("attendance_records")
          .select("*, members(first_name, last_name, email)", { count: "exact" })
          .eq("session_id", sessionId)
          .eq("tenant_id", tenantId)
          .range(offset, offset + limit - 1);

        if (error) throw error;
        responseData = { data: data || [], count: count || 0, limit, offset };
        break;
      }

      default:
        return new Response(JSON.stringify({
          error: `Unknown resource: ${resource}`,
          available_resources: ["members", "attendance_sessions", "attendance_records"],
        }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("External API error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
