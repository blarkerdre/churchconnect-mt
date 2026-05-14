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
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // Get all active subscriptions that are past due
    const { data: overdueSubscriptions, error } = await supabaseAdmin
      .from("tenant_subscriptions")
      .select("*, tenants!inner(id, name, subscription_status)")
      .eq("is_active", true)
      .lt("next_due_date", today);

    if (error) throw error;
    if (!overdueSubscriptions || overdueSubscriptions.length === 0) {
      return new Response(JSON.stringify({ message: "No overdue subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    let stripe: Stripe | null = null;
    if (stripeKey) {
      stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    }

    let updatedCount = 0;

    for (const sub of overdueSubscriptions) {
      // For Stripe-managed subscriptions, check Stripe status directly
      if (sub.stripe_subscription_id && stripe) {
        try {
          const stripeSub = await stripe.subscriptions.retrieve(sub.stripe_subscription_id);
          // If Stripe says active, trust it and skip date-based logic
          if (stripeSub.status === "active" || stripeSub.status === "trialing") {
            // Update next_due_date from Stripe
            const nextDue = new Date(stripeSub.current_period_end * 1000).toISOString().split("T")[0];
            await supabaseAdmin
              .from("tenant_subscriptions")
              .update({ next_due_date: nextDue })
              .eq("id", sub.id);

            if (sub.tenants?.subscription_status !== "active") {
              await supabaseAdmin
                .from("tenants")
                .update({ subscription_status: "active" })
                .eq("id", sub.tenant_id);
              updatedCount++;
            }
            continue;
          }
          // If Stripe says past_due or unpaid, fall through to date-based logic
        } catch (stripeErr) {
          console.error(`[check-tenant-payments] Stripe lookup failed for ${sub.stripe_subscription_id}:`, stripeErr.message);
          // Fall through to date-based logic
        }
      }

      // Date-based logic for manual billing or Stripe fallback
      const dueDate = new Date(sub.next_due_date);
      const daysPastDue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
      const gracePeriod = sub.grace_period_days || 7;

      let newStatus: string;
      if (daysPastDue > gracePeriod) {
        newStatus = "suspended";
      } else {
        newStatus = "past_due";
      }

      const currentStatus = sub.tenants?.subscription_status;
      if (currentStatus === newStatus) continue;

      await supabaseAdmin
        .from("tenants")
        .update({ subscription_status: newStatus })
        .eq("id", sub.tenant_id);

      // Notify tenant owners/admins
      const { data: admins } = await supabaseAdmin
        .from("tenant_memberships")
        .select("user_id")
        .eq("tenant_id", sub.tenant_id)
        .in("role", ["owner", "admin"]);

      if (admins && admins.length > 0) {
        const title = newStatus === "suspended" ? "Subscription Suspended" : "Payment Overdue";
        const message = newStatus === "suspended"
          ? `Your subscription for ${sub.tenants?.name || "your church"} has been suspended due to non-payment. Please make a payment to restore access.`
          : `Your subscription payment is overdue by ${daysPastDue} day(s). Please make a payment within ${gracePeriod - daysPastDue} day(s) to avoid suspension.`;

        const notifications = admins.map((a) => ({
          user_id: a.user_id,
          title,
          message,
          type: "billing",
          reference_type: "tenant_subscription",
          reference_id: sub.id,
          tenant_id: sub.tenant_id,
        }));

        await supabaseAdmin.from("notifications").insert(notifications);
      }

      updatedCount++;
    }

    return new Response(
      JSON.stringify({ message: `Processed ${updatedCount} overdue subscriptions` }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[check-tenant-payments] Error:", error);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
