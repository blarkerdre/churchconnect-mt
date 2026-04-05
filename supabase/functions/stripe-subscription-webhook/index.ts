import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, stripe-signature, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[stripe-webhook] ${step}${d}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2025-08-27.basil",
  });

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  const signature = req.headers.get("stripe-signature");

  let event: Stripe.Event;
  const body = await req.text();

  try {
    if (webhookSecret && signature) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      event = JSON.parse(body);
    }
  } catch (err) {
    console.error("[stripe-webhook] Signature verification failed:", err.message);
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } }
  );

  try {
    logStep("Event received", { type: event.type });

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const stripeSubscriptionId = session.subscription as string;

        if (!stripeSubscriptionId) {
          logStep("No subscription in checkout session, skipping");
          break;
        }

        // Retrieve subscription to get metadata
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const tenantId = stripeSub.metadata?.tenant_id;
        const subscriptionId = stripeSub.metadata?.subscription_id;

        if (!tenantId) {
          logStep("No tenant_id in subscription metadata, skipping");
          break;
        }

        // Store stripe_subscription_id and stripe_customer_id
        const updatePayload: Record<string, any> = {
          stripe_subscription_id: stripeSubscriptionId,
          stripe_customer_id: session.customer as string,
        };

        // Store the price ID from the subscription
        if (stripeSub.items?.data?.[0]?.price?.id) {
          updatePayload.stripe_price_id = stripeSub.items.data[0].price.id;
        }

        if (subscriptionId) {
          await supabaseAdmin
            .from("tenant_subscriptions")
            .update(updatePayload)
            .eq("id", subscriptionId);
        } else {
          await supabaseAdmin
            .from("tenant_subscriptions")
            .update(updatePayload)
            .eq("tenant_id", tenantId)
            .eq("is_active", true);
        }

        logStep("Stored stripe_subscription_id", { tenantId, stripeSubscriptionId });
        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.subscription as string;

        if (!stripeSubscriptionId) {
          logStep("No subscription on invoice, skipping");
          break;
        }

        // Retrieve subscription metadata to get tenant_id
        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const tenantId = stripeSub.metadata?.tenant_id;
        const subscriptionId = stripeSub.metadata?.subscription_id;

        if (!tenantId) {
          logStep("No tenant_id in subscription metadata for invoice, skipping");
          break;
        }

        // Record payment
        await supabaseAdmin.from("tenant_payments").insert({
          tenant_id: tenantId,
          subscription_id: subscriptionId || null,
          amount: (invoice.amount_paid || 0) / 100,
          currency: (invoice.currency || "gbp").toUpperCase(),
          payment_date: new Date().toISOString().split("T")[0],
          payment_method: "Stripe",
          stripe_payment_intent_id: invoice.payment_intent as string,
          reference: invoice.id,
          status: "completed",
        });

        // Set tenant status to active
        await supabaseAdmin
          .from("tenants")
          .update({ subscription_status: "active" })
          .eq("id", tenantId);

        logStep("Payment recorded & status set to active", { tenantId, amount: (invoice.amount_paid || 0) / 100 });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const stripeSubscriptionId = invoice.subscription as string;

        if (!stripeSubscriptionId) break;

        const stripeSub = await stripe.subscriptions.retrieve(stripeSubscriptionId);
        const tenantId = stripeSub.metadata?.tenant_id;

        if (!tenantId) break;

        // Set tenant status to past_due
        await supabaseAdmin
          .from("tenants")
          .update({ subscription_status: "past_due" })
          .eq("id", tenantId);

        // Notify admins
        const { data: admins } = await supabaseAdmin
          .from("tenant_memberships")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .in("role", ["owner", "admin"]);

        if (admins && admins.length > 0) {
          const notifications = admins.map((a) => ({
            user_id: a.user_id,
            title: "Payment Failed",
            message: "Your subscription payment has failed. Please update your payment method to avoid service interruption.",
            type: "billing",
            reference_type: "tenant_subscription",
            tenant_id: tenantId,
          }));
          await supabaseAdmin.from("notifications").insert(notifications);
        }

        logStep("Payment failed, status set to past_due", { tenantId });
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const tenantId = subscription.metadata?.tenant_id;

        if (!tenantId) break;

        // Set tenant status to suspended
        await supabaseAdmin
          .from("tenants")
          .update({ subscription_status: "suspended" })
          .eq("id", tenantId);

        // Clear stripe_subscription_id
        await supabaseAdmin
          .from("tenant_subscriptions")
          .update({ stripe_subscription_id: null, stripe_price_id: null })
          .eq("tenant_id", tenantId)
          .eq("is_active", true);

        // Notify admins
        const { data: admins } = await supabaseAdmin
          .from("tenant_memberships")
          .select("user_id")
          .eq("tenant_id", tenantId)
          .in("role", ["owner", "admin"]);

        if (admins && admins.length > 0) {
          const notifications = admins.map((a) => ({
            user_id: a.user_id,
            title: "Subscription Cancelled",
            message: "Your subscription has been cancelled. Access will be restricted until a new subscription is activated.",
            type: "billing",
            reference_type: "tenant_subscription",
            tenant_id: tenantId,
          }));
          await supabaseAdmin.from("notifications").insert(notifications);
        }

        logStep("Subscription deleted, status set to suspended", { tenantId });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[stripe-webhook] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
