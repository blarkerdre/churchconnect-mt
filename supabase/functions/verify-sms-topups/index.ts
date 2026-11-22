import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Checks this church's unfinished card top-ups with Stripe and adds texts for any that were paid.
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  try {
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);
    const body = await req.json().catch(() => ({}));
    const tenantId = typeof body.tenant_id === "string" ? body.tenant_id : "";
    if (!/^[0-9a-f-]{36}$/i.test(tenantId)) return json({ error: "Invalid church" }, 400);
    const { data: m } = await admin.from("tenant_memberships").select("role").eq("tenant_id", tenantId).eq("user_id", u.user.id).maybeSingle();
    const { data: sa } = await admin.from("user_roles").select("role").eq("user_id", u.user.id).eq("role", "super_admin").limit(1);
    // Only the church's owners/admins (or super admins) may check and apply top-ups.
    const isChurchAdmin = !!m && ["owner", "admin"].includes(String(m.role));
    if (!isChurchAdmin && !(sa && sa.length)) return json({ error: "Not allowed" }, 403);

    const since = new Date(Date.now() - 30 * 86400000).toISOString();
    const { data: pending } = await admin.from("sms_topups").select("id, stripe_session_id")
      .eq("tenant_id", tenantId).eq("status", "pending").not("stripe_session_id", "is", null).gte("created_at", since).limit(20);
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
    let added = 0;
    for (const t of pending || []) {
      try {
        const s = await stripe.checkout.sessions.retrieve(t.stripe_session_id!);
        if (s.payment_status === "paid" && s.metadata?.type === "sms_topup" && s.metadata?.tenant_id === tenantId) {
          const { data: n } = await admin.rpc("add_sms_credits_for_topup", { _session_id: s.id });
          added += Number(n || 0);
        } else if (s.status === "expired") {
          await admin.from("sms_topups").update({ status: "cancelled" }).eq("id", t.id).eq("tenant_id", tenantId).eq("status", "pending");
        }
      } catch (e) { console.error("[verify-sms-topups] session check failed", t.id, (e as Error).message); }
    }
    return json({ added });
  } catch (e) {
    console.error("[verify-sms-topups]", e);
    return json({ error: "Could not check payments" }, 500);
  }
});
