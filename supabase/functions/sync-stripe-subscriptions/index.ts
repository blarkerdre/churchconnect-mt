import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isAuthorizedScheduler } from "../_shared/scheduler-auth.ts";
import { syncTenantFromStripe } from "../_shared/stripe-sync.ts";

// Daily catch-up: applies renewals, failures and cancellations Stripe may not have delivered.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  if (!(await isAuthorizedScheduler(req, db))) return new Response("Forbidden", { status: 403, headers: corsHeaders });
  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
  const { data: rows } = await db.from("tenant_subscriptions").select("tenant_id").eq("is_active", true).not("stripe_customer_id", "is", null);
  const results: Record<string, unknown> = {};
  for (const r of rows || []) {
    try { results[r.tenant_id] = await syncTenantFromStripe(db, stripe, r.tenant_id); }
    catch (e) { results[r.tenant_id] = { error: (e as Error).message }; console.error("[sync-stripe-subscriptions]", r.tenant_id, e); }
  }
  return new Response(JSON.stringify({ checked: rows?.length || 0, results }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});
