import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "npm:stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2";
import { linkSubscription, recordPaidInvoice, markPastDue, markCancelled, invoiceSubscriptionId } from "../_shared/stripe-sync.ts";

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

  // SECURITY: fail closed when the webhook secret is unset.
  // Accepting unsigned events lets attackers forge payment notifications.
  if (!webhookSecret) {
    console.error("[stripe-webhook] STRIPE_WEBHOOK_SECRET is not configured - rejecting request");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
  if (!signature) {
    console.error("[stripe-webhook] Missing stripe-signature header");
    return new Response(JSON.stringify({ error: "Missing signature" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  let event: Stripe.Event;
  const body = await req.text();

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
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
        if (session.metadata?.type === "sms_topup") {
          if (session.payment_status === "paid") {
            const { data: added, error } = await supabaseAdmin.rpc("add_sms_credits_for_topup", { _session_id: session.id });
            logStep("SMS top-up credited", { added, error: error?.message });
          }
          break;
        }
        if (!session.subscription) { logStep("No subscription in checkout session, skipping"); break; }
        const stripeSub = await stripe.subscriptions.retrieve(session.subscription as string);
        await linkSubscription(supabaseAdmin, stripeSub);
        break;
      }

      case "invoice.payment_succeeded":
      case "invoice.paid": {
        await recordPaidInvoice(supabaseAdmin, stripe, event.data.object);
        break;
      }

      case "invoice.payment_failed": {
        const subId = invoiceSubscriptionId(event.data.object);
        if (!subId) break;
        const stripeSub = await stripe.subscriptions.retrieve(subId);
        if (stripeSub.metadata?.tenant_id) await markPastDue(supabaseAdmin, stripeSub.metadata.tenant_id);
        break;
      }

      case "customer.subscription.deleted": {
        await markCancelled(supabaseAdmin, event.data.object as Stripe.Subscription);
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
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
