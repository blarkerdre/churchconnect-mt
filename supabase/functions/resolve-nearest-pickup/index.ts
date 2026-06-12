// Resolves nearest active pickup_location for a tenant given a UK postcode.
// Uses postcodes.io (free, no API key). Lazily backfills lat/lng on pickup_locations.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

async function geocode(postcode: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(postcode.trim())}`);
    if (!res.ok) return null;
    const j = await res.json();
    const r = j?.result;
    if (typeof r?.latitude === "number" && typeof r?.longitude === "number") {
      return { lat: r.latitude, lng: r.longitude };
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { tenant_id, postcode } = await req.json();
    if (!tenant_id || !postcode || typeof postcode !== "string") {
      return new Response(JSON.stringify({ error: "tenant_id and postcode required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!UK_POSTCODE.test(postcode.trim())) {
      return new Response(JSON.stringify({ error: "Invalid UK postcode", match: null }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Validate caller session
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (token) {
      const { data: ures } = await supabase.auth.getUser(token);
      if (!ures?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const passenger = await geocode(postcode);
    if (!passenger) {
      return new Response(JSON.stringify({ match: null, reason: "geocode_failed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: locations, error } = await supabase
      .from("pickup_locations")
      .select("id, name, address, postcode, latitude, longitude")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true);

    if (error) throw error;
    if (!locations || locations.length === 0) {
      return new Response(JSON.stringify({ match: null, reason: "no_locations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Lazily geocode locations missing lat/lng but with postcode
    const enriched: Array<{ id: string; name: string; address: string; lat: number; lng: number }> = [];
    for (const loc of locations) {
      let lat = loc.latitude as number | null;
      let lng = loc.longitude as number | null;
      if ((lat == null || lng == null) && loc.postcode && UK_POSTCODE.test(loc.postcode)) {
        const g = await geocode(loc.postcode);
        if (g) {
          lat = g.lat;
          lng = g.lng;
          await supabase
            .from("pickup_locations")
            .update({ latitude: lat, longitude: lng })
            .eq("id", loc.id)
            .eq("tenant_id", tenant_id);
        }
      }
      if (lat != null && lng != null) {
        enriched.push({ id: loc.id, name: loc.name, address: loc.address, lat, lng });
      }
    }

    if (enriched.length === 0) {
      return new Response(JSON.stringify({ match: null, reason: "no_geocoded_locations" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let best = enriched[0];
    let bestDist = haversineKm(passenger.lat, passenger.lng, best.lat, best.lng);
    for (let i = 1; i < enriched.length; i++) {
      const d = haversineKm(passenger.lat, passenger.lng, enriched[i].lat, enriched[i].lng);
      if (d < bestDist) {
        bestDist = d;
        best = enriched[i];
      }
    }

    return new Response(
      JSON.stringify({
        match: {
          id: best.id,
          name: best.name,
          address: best.address,
          distance_km: Math.round(bestDist * 10) / 10,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
