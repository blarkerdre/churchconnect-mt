import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** country/city cache keyed by IP, kept only in memory for the life of the isolate */
const geoCache = new Map<string, { country: string | null; city: string | null }>();

function clientIp(req: Request): string | null {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") || req.headers.get("x-real-ip");
}

async function resolveGeo(req: Request, ip: string | null) {
  const headerCountry = req.headers.get("cf-ipcountry") || req.headers.get("x-vercel-ip-country");
  const headerCity = req.headers.get("x-vercel-ip-city");
  if (headerCountry && headerCountry !== "XX") {
    return { country: headerCountry, city: headerCity ? decodeURIComponent(headerCity) : null };
  }
  if (!ip || ip.startsWith("127.") || ip.startsWith("10.") || ip.startsWith("192.168.")) {
    return { country: null, city: null };
  }
  const cached = geoCache.get(ip);
  if (cached) return cached;
  try {
    const res = await fetch(`http://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,country,city`);
    if (res.ok) {
      const j = await res.json();
      const geo = j?.status === "success"
        ? { country: j.country ?? null, city: j.city ?? null }
        : { country: null, city: null };
      if (geoCache.size < 5000) geoCache.set(ip, geo);
      return geo;
    }
  } catch (_e) {
    // geo lookup is best-effort
  }
  return { country: null, city: null };
}

function deviceType(ua: string | null): string {
  const s = (ua || "").toLowerCase();
  if (/ipad|tablet/.test(s)) return "tablet";
  if (/mobi|android|iphone/.test(s)) return "mobile";
  return "desktop";
}

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  if (!t) return null;
  return t.slice(0, max);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const path = str(body.path, 300);
    const visitorId = str(body.visitor_id, 64);
    const sessionId = str(body.session_id, 64);
    if (!path || !visitorId || !sessionId) {
      return new Response(JSON.stringify({ error: "path, visitor_id and session_id are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const referrer = str(body.referrer, 300);
    const tenantSlug = str(body.tenant_slug, 100);
    const isAuthenticated = body.is_authenticated === true;

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    });

    // Rate limit per visitor: 120 views / 5 minutes
    const { data: allowed } = await supabase.rpc("check_and_bump_rate_limit", {
      _ip_hash: `pv:${visitorId}`,
      _endpoint: "track-pageview",
      _limit: 120,
      _window_minutes: 5,
    });
    if (allowed === false) {
      return new Response(JSON.stringify({ ok: true, throttled: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let tenantId: string | null = null;
    if (tenantSlug) {
      const { data: tenant } = await supabase
        .from("tenants")
        .select("id")
        .eq("slug", tenantSlug)
        .maybeSingle();
      tenantId = tenant?.id ?? null;
    }

    const ip = clientIp(req);
    const geo = await resolveGeo(req, ip);

    const { error } = await supabase.from("analytics_page_views").insert({
      tenant_id: tenantId,
      visitor_id: visitorId,
      session_id: sessionId,
      path,
      referrer,
      country: geo.country,
      city: geo.city,
      device_type: deviceType(req.headers.get("user-agent")),
      is_authenticated: isAuthenticated,
    });
    if (error) {
      console.error("track-pageview insert failed:", error.message);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("track-pageview error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
