import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    const { tenant_id, action } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");
    if (!action || !["cancel", "portal"].includes(action)) {
      throw new Error("action must be 'cancel' or 'portal'");
    }

    // Verify user is admin/owner
    const { data: membership } = await supabaseAdmin
      .from("tenant_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only tenant owners or admins can manage subscriptions");
    }

    // Get subscription
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("stripe_subscription_id, stripe_customer_id")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!sub?.stripe_customer_id) {
      throw new Error("No Stripe customer found for this tenant");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    if (action === "portal") {
      const RETURN_BASE = "https://app.churchmanagementsuite.org";
      const portalSession = await stripe.billingPortal.sessions.create({
        customer: sub.stripe_customer_id,
        return_url: `${RETURN_BASE}/settings`,
      });

      return new Response(JSON.stringify({ url: portalSession.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "cancel") {
      if (!sub.stripe_subscription_id) {
        throw new Error("No active Stripe subscription to cancel");
      }

      await stripe.subscriptions.cancel(sub.stripe_subscription_id);

      return new Response(JSON.stringify({ success: true, message: "Subscription cancelled" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (error) {
    console.error("[manage-tenant-subscription] Error:", error);
    const safeMessage = error?.message === "Not authenticated" ? "Not authenticated" : "Request failed";
    return new Response(JSON.stringify({ error: safeMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
