import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
    const { data: userData } = await userClient.auth.getUser();
    if (!userData?.user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { tenant_id, label } = await req.json();
    if (!tenant_id || !label) return new Response(JSON.stringify({ error: "tenant_id and label required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const svc = createClient(supabaseUrl, serviceKey);
    const { data: isAdmin } = await svc.rpc("is_admin", { _user_id: userData.user.id, _tenant_id: tenant_id });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin access required for this tenant" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    // Generate 32-byte hex key
    const bytes = new Uint8Array(32);
    crypto.getRandomValues(bytes);
    const apiKey = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const keyHash = await sha256Hex(apiKey);
    const keyPrefix = apiKey.slice(0, 8);

    const { data: row, error } = await svc.from("tenant_api_keys").insert({
      tenant_id,
      label: String(label).trim(),
      created_by: userData.user.id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      is_active: true,
    }).select("id, label, key_prefix, created_at").single();

    if (error) { console.error("create-tenant-api-key insert error:", error); return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }

    return new Response(JSON.stringify({ ...row, api_key: apiKey }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) { console.error("create-tenant-api-key error:", err); return new Response(JSON.stringify({ error: "An unexpected error occurred" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
});
