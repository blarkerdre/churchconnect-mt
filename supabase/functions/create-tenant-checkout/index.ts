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

    // Create checkout session with a one-time payment for the subscription amount
    const origin = req.headers.get("origin") || "https://churchconnect-mt.lovable.app";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: sub.currency.toLowerCase(),
            product_data: {
              name: `Church Management - ${sub.billing_cycle === "yearly" ? "Annual" : "Monthly"} Subscription`,
            },
            unit_amount: Math.round(Number(sub.amount) * 100),
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${origin}/settings?payment=success`,
      cancel_url: `${origin}/settings?payment=cancelled`,
      metadata: {
        tenant_id,
        subscription_id: sub.id,
        billing_cycle: sub.billing_cycle,
      },
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[create-tenant-checkout] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
