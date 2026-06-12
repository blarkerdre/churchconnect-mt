// Create a DomiFort API token (super-admin only). Returns plaintext bearer + signing secret ONCE.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function randomToken(prefix: string, bytes = 30): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  const b64 = btoa(String.fromCharCode(...arr)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${prefix}${b64}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await userClient.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const admin = createClient(supabaseUrl, serviceRoleKey);

    // Verify super_admin
    const { data: roleRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "super_admin")
      .maybeSingle();

    if (!roleRow) {
      return new Response(JSON.stringify({ error: "Forbidden: super admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const label = typeof body?.label === "string" ? body.label.trim() : "";
    if (!label || label.length > 120) {
      return new Response(JSON.stringify({ error: "Label is required (1-120 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bearer = randomToken("df_live_", 30);
    const signingSecret = randomToken("whsec_", 30);
    const tokenHash = await sha256Hex(bearer);
    const signingSecretHash = await sha256Hex(signingSecret);

    const { data: inserted, error: insErr } = await admin
      .from("domifort_api_tokens")
      .insert({
        label,
        token_hash: tokenHash,
        token_prefix: bearer.slice(0, 16),
        signing_secret_hash: signingSecretHash,
        signing_secret_prefix: signingSecret.slice(0, 12),
        created_by: userId,
      })
      .select("id, label, token_prefix, signing_secret_prefix, created_at")
      .single();

    if (insErr) {
      console.error("[domifort-token-create] insert error:", insErr);
      return new Response(JSON.stringify({ error: "Failed to create token" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // IMPORTANT: the signing secret returned here IS the HMAC key DomiFort must use.
    // We return signing_secret_hash as the key (it's a long random hex string), so we can
    // verify signatures without ever storing the original random bytes.
    return new Response(
      JSON.stringify({
        token: inserted,
        plaintext: {
          bearer_token: bearer,
          signing_secret: signingSecretHash, // hex string used as HMAC key
        },
        warning: "Store these values now. They will not be shown again.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[domifort-token-create] Error:", message);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
