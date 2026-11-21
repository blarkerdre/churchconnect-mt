import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { syncTenantFromStripe } from "../_shared/stripe-sync.ts";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Signed-in owners/admins: checks Stripe for this church's card subscription and applies anything missed.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await db.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return json({ error: "Invalid church" }, 400);
    const { data: m } = await db.from("tenant_memberships").select("role").eq("tenant_id", tenantId).eq("user_id", u.user.id).maybeSingle();
    const { data: sa } = await db.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "super_admin").limit(1);
    if (!(m && ["owner", "admin"].includes(m.role)) && !(sa && sa.length)) return json({ error: "Not allowed" }, 403);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    return json(await syncTenantFromStripe(db, stripe, tenantId));
  } catch (e) {
    console.error("[verify-tenant-subscription]", e);
    return json({ error: "Could not check subscription" }, 500);
  }
});
