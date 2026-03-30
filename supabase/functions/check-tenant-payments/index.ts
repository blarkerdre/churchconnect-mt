import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    let updatedCount = 0;

    for (const sub of overdueSubscriptions) {
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

      // Update tenant status
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
        const title = newStatus === "suspended"
          ? "Subscription Suspended"
          : "Payment Overdue";
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
    console.error("[check-tenant-payments] Error:", error.message);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
});
