// Auto-match transportation bookings to drivers using:
//   1) postcode outward-code match against driver_availability.pickup_area_postcode
//   2) haversine geo fallback via postcodes.io
// Validates caller JWT + tenant membership; performs updates with service role.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UK_POSTCODE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

function outward(pc?: string | null) {
  if (!pc) return "";
  return String(pc).trim().toUpperCase().split(/\s+/)[0] || "";
}

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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: ures } = await supabase.auth.getUser(token);
    if (!ures?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = ures.user.id;

    const body = await req.json().catch(() => ({}));
    const tenant_id: string | undefined = body?.tenant_id;
    let booking_ids: string[] = [];
    if (Array.isArray(body?.booking_ids)) booking_ids = body.booking_ids.filter((x: any) => typeof x === "string");
    else if (typeof body?.booking_id === "string") booking_ids = [body.booking_id];

    if (!tenant_id || booking_ids.length === 0) {
      return new Response(JSON.stringify({ error: "tenant_id and booking_id(s) required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant membership check
    const { data: membership } = await supabase
      .from("tenant_memberships")
      .select("tenant_id")
      .eq("tenant_id", tenant_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!membership) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load bookings
    const { data: bookings, error: bErr } = await supabase
      .from("transportation")
      .select("id, request_date, pickup_postcode, pickup_address, passengers, service_type, driver_user_id, status")
      .in("id", booking_ids)
      .eq("tenant_id", tenant_id);
    if (bErr) throw bErr;

    const matches: any[] = [];
    // Cache driver availability per date and driver geocodes
    const availByDate = new Map<string, any[]>();
    const geoCache = new Map<string, { lat: number; lng: number } | null>();

    async function loadAvailability(date: string) {
      if (availByDate.has(date)) return availByDate.get(date)!;
      const { data } = await supabase
        .from("driver_availability")
        .select("id, driver_user_id, driver_member_id, available_date, service_type, pickup_area_postcode, seats_available, status")
        .eq("tenant_id", tenant_id)
        .eq("available_date", date);
      const rows = (data || []).filter((r: any) => !r.status || r.status === "Available" || r.status === "Confirmed");
      availByDate.set(date, rows);
      return rows;
    }

    // Pre-compute already-assigned seat usage per (date, driver_user_id)
    const dates = Array.from(new Set(bookings?.map((b: any) => b.request_date).filter(Boolean) || []));
    const usage = new Map<string, number>(); // key: `${date}|${driver_user_id}` -> seats used
    if (dates.length) {
      const { data: usedRows } = await supabase
        .from("transportation")
        .select("request_date, driver_user_id, passengers, status")
        .eq("tenant_id", tenant_id)
        .in("request_date", dates as string[])
        .not("driver_user_id", "is", null);
      (usedRows || []).forEach((r: any) => {
        if (["Cancelled", "No-Show"].includes(r.status)) return;
        const k = `${r.request_date}|${r.driver_user_id}`;
        usage.set(k, (usage.get(k) || 0) + (r.passengers || 1));
      });
    }

    for (const b of (bookings || [])) {
      if (b.driver_user_id) {
        matches.push({ booking_id: b.id, skipped: "already_assigned" });
        continue;
      }
      const avail = await loadAvailability(b.request_date);
      const filtered = avail.filter((a: any) => !b.service_type || !a.service_type || a.service_type === b.service_type);
      if (!filtered.length) {
        matches.push({ booking_id: b.id, skipped: "no_drivers" });
        continue;
      }

      const seatsNeeded = b.passengers || 1;
      const candidates = filtered.filter((a: any) => {
        const used = usage.get(`${b.request_date}|${a.driver_user_id}`) || 0;
        return (a.seats_available || 0) - used >= seatsNeeded;
      });
      if (!candidates.length) {
        matches.push({ booking_id: b.id, skipped: "no_seats" });
        continue;
      }

      const bookingOut = outward(b.pickup_postcode);
      let chosen: any = null;
      let reason = "";

      if (bookingOut) {
        const exact = candidates.filter((a: any) => outward(a.pickup_area_postcode) === bookingOut);
        if (exact.length) {
          exact.sort((a: any, x: any) => (x.seats_available || 0) - (a.seats_available || 0));
          chosen = exact[0];
          reason = "postcode_match";
        }
      }

      if (!chosen && bookingOut && UK_POSTCODE.test(b.pickup_postcode || "")) {
        // Geo fallback
        const pKey = (b.pickup_postcode || "").toUpperCase().trim();
        if (!geoCache.has(pKey)) geoCache.set(pKey, await geocode(pKey));
        const pGeo = geoCache.get(pKey);
        if (pGeo) {
          let best: any = null;
          let bestDist = Infinity;
          for (const a of candidates) {
            const ap = (a.pickup_area_postcode || "").toUpperCase().trim();
            if (!ap || !UK_POSTCODE.test(ap)) continue;
            if (!geoCache.has(ap)) geoCache.set(ap, await geocode(ap));
            const ag = geoCache.get(ap);
            if (!ag) continue;
            const d = haversineKm(pGeo.lat, pGeo.lng, ag.lat, ag.lng);
            if (d < bestDist) { bestDist = d; best = a; }
          }
          if (best) {
            chosen = best;
            reason = `nearest_${Math.round(bestDist * 10) / 10}km`;
          }
        }
      }

      if (!chosen) {
        // Last resort: pick driver with most remaining seats
        candidates.sort((a: any, x: any) => (x.seats_available || 0) - (a.seats_available || 0));
        chosen = candidates[0];
        reason = "fallback_capacity";
      }

      // Look up driver name from members
      let driverName = "";
      if (chosen.driver_member_id) {
        const { data: m } = await supabase
          .from("members")
          .select("first_name, last_name")
          .eq("id", chosen.driver_member_id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        if (m) driverName = `${m.first_name} ${m.last_name}`.trim();
      }
      if (!driverName && chosen.driver_user_id) {
        const { data: m } = await supabase
          .from("members")
          .select("first_name, last_name")
          .eq("user_id", chosen.driver_user_id)
          .eq("tenant_id", tenant_id)
          .maybeSingle();
        if (m) driverName = `${m.first_name} ${m.last_name}`.trim();
      }

      const { error: uErr } = await supabase
        .from("transportation")
        .update({
          driver_user_id: chosen.driver_user_id,
          assigned_to: chosen.driver_user_id,
          assigned_driver: driverName || null,
          status: "Confirmed",
          assigned_at: new Date().toISOString(),
          auto_matched: true,
        })
        .eq("id", b.id)
        .eq("tenant_id", tenant_id);

      if (uErr) {
        matches.push({ booking_id: b.id, error: uErr.message });
        continue;
      }
      // Update usage cache so subsequent bookings respect new assignment
      const k = `${b.request_date}|${chosen.driver_user_id}`;
      usage.set(k, (usage.get(k) || 0) + seatsNeeded);

      matches.push({
        booking_id: b.id,
        driver_user_id: chosen.driver_user_id,
        driver_name: driverName,
        reason,
      });
    }

    return new Response(JSON.stringify({ matches }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as any)?.message || err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
