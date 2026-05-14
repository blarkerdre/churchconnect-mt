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
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !userData.user) throw new Error("Not authenticated");
    const user = userData.user;

    const { tenant_id } = await req.json();
    if (!tenant_id) throw new Error("tenant_id is required");

    // Verify user is admin/owner of this tenant
    const { data: membership } = await supabaseAdmin
      .from("tenant_memberships")
      .select("role")
      .eq("user_id", user.id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    if (!membership || !["owner", "admin"].includes(membership.role)) {
      throw new Error("Only tenant owners or admins can initiate payment");
    }

    // Get subscription details
    const { data: sub } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("is_active", true)
      .maybeSingle();

    if (!sub) throw new Error("No active subscription found for this tenant");

    // If tenant already has an active Stripe subscription, redirect to portal instead
    if (sub.stripe_subscription_id) {
      throw new Error("Tenant already has an active Stripe subscription. Use the Manage Subscription option instead.");
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    // Find or create customer
    let customerId = sub.stripe_customer_id;
    if (!customerId) {
      const { data: tenant } = await supabaseAdmin
        .from("tenants")
        .select("name")
        .eq("id", tenant_id)
        .single();

      const customer = await stripe.customers.create({
        email: user.email,
        name: tenant?.name || "Church Tenant",
        metadata: { tenant_id },
      });
      customerId = customer.id;

      await supabaseAdmin
        .from("tenant_subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("id", sub.id);
    }

    // Create checkout session with recurring subscription
    const origin = req.headers.get("origin") || "https://churchconnect-mt.lovable.app";

    const lineItems: any[] = [
      {
        price_data: {
          currency: sub.currency.toLowerCase(),
          product_data: {
            name: `Church Management - ${sub.billing_cycle === "yearly" ? "Annual" : "Monthly"} Subscription`,
          },
          unit_amount: Math.round(Number(sub.amount) * 100),
          recurring: {
            interval: sub.billing_cycle === "yearly" ? "year" : "month",
          },
        },
        quantity: 1,
      },
    ];

    // Add one-time setup fee if configured and not yet paid
    const setupFeeAmount = Number(sub.setup_fee_amount || 0);
    if (setupFeeAmount > 0 && !sub.setup_fee_paid) {
      lineItems.push({
        price_data: {
          currency: sub.currency.toLowerCase(),
          product_data: {
            name: "One-Time Setup Fee",
          },
          unit_amount: Math.round(setupFeeAmount * 100),
        },
        quantity: 1,
      });
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: lineItems,
      mode: "subscription",
      success_url: `${origin}/settings?payment=success`,
      cancel_url: `${origin}/settings?payment=cancelled`,
      subscription_data: {
        metadata: {
          tenant_id,
          subscription_id: sub.id,
          billing_cycle: sub.billing_cycle,
          setup_fee_charged: setupFeeAmount > 0 && !sub.setup_fee_paid ? "true" : "false",
        },
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-tenant-checkout] Error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
