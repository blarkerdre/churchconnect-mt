import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const TWILIO_GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function mapTwilioToStatus(twilioStatus: string): { delivery_status: string; status?: string } {
  const s = (twilioStatus || "").toLowerCase();
  if (s === "delivered") return { delivery_status: "delivered", status: "delivered" };
  if (s === "failed") return { delivery_status: "failed", status: "failed" };
  if (s === "undelivered") return { delivery_status: "undelivered", status: "failed" };
  if (s === "sent") return { delivery_status: "sent" };
  return { delivery_status: s || "unknown" };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { tenant_id, message_sids } = body as { tenant_id?: string; message_sids?: string[] };

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant admin
    const { data: isAdmin } = await serviceClient.rpc("is_admin", {
      _user_id: user.id,
      _tenant_id: tenant_id,
    });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY") || Deno.env.get("TWILIO_API_KEY_1");
    if (!LOVABLE_API_KEY || !TWILIO_API_KEY) {
      return new Response(JSON.stringify({ error: "Twilio gateway not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch stuck rows
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    let q = serviceClient
      .from("sms_log")
      .select("id, message_sid, status, delivery_status, provider, created_at")
      .eq("tenant_id", tenant_id)
      .eq("provider", "twilio")
      .not("message_sid", "is", null)
      .gte("created_at", since)
      .limit(200);

    if (Array.isArray(message_sids) && message_sids.length > 0) {
      q = q.in("message_sid", message_sids);
    } else {
      // Stuck candidates only
      q = q.or(
        "delivery_status.is.null,delivery_status.eq.queued,delivery_status.eq.accepted,delivery_status.eq.sending,delivery_status.eq.scheduled"
      );
    }

    const { data: rows, error: rowsErr } = await q;
    if (rowsErr) throw rowsErr;

    let updated = 0;
    let unchanged = 0;
    let failed = 0;

    for (const row of rows || []) {
      try {
        const resp = await fetch(`${TWILIO_GATEWAY_URL}/Messages/${row.message_sid}.json`, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "X-Connection-Api-Key": TWILIO_API_KEY,
          },
        });
        const data = await resp.json().catch(() => ({}));
        if (!resp.ok) {
          console.warn(`Twilio fetch failed for ${row.message_sid}:`, resp.status, data);
          failed++;
          continue;
        }

        const liveStatus: string = data.status || "";
        const mapped = mapTwilioToStatus(liveStatus);

        if (mapped.delivery_status === row.delivery_status && (!mapped.status || mapped.status === row.status)) {
          unchanged++;
          continue;
        }

        const update: Record<string, unknown> = {
          delivery_status: mapped.delivery_status,
          delivery_updated_at: new Date().toISOString(),
        };
        if (mapped.status) update.status = mapped.status;
        if (data.error_message || data.error_code) {
          update.error_message = `${data.error_code || ""}: ${data.error_message || ""}`.trim();
        }

        const { error: upErr } = await serviceClient
          .from("sms_log")
          .update(update)
          .eq("id", row.id);
        if (upErr) {
          console.warn(`Update failed for ${row.id}:`, upErr.message);
          failed++;
        } else {
          updated++;
        }
      } catch (e) {
        console.warn(`Error processing ${row.message_sid}:`, e instanceof Error ? e.message : e);
        failed++;
      }
    }

    return new Response(
      JSON.stringify({ scanned: rows?.length || 0, updated, unchanged, failed }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("refresh-sms-status error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
