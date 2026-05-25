import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VAPID_PUBLIC_KEY =
  "BMHyudDLP9eFo0-FhiS-U8tVdJ0oRHKblJ0FILMcwGJkNva6AoPM8bKo5pP6kjg4hWHnoxULBJAw-MPv-1mjhD0";
const VAPID_SUBJECT = "mailto:admin@churchmanagementsuite.org";

const referenceRoutes: Record<string, string> = {
  event: "/events",
  announcement: "/communications",
  followup: "/followups",
  pastoral_care: "/pastoral-care",
  transport: "/transportation",
  meeting: "/wsf",
  unit_join_request: "/",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const VAPID_PRIVATE_KEY = Deno.env.get("VAPID_PRIVATE_KEY");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;

    if (!VAPID_PRIVATE_KEY) {
      return new Response(JSON.stringify({ error: "VAPID_PRIVATE_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

    const supabase = createClient(supabaseUrl, serviceKey);
    const { notification_id } = await req.json();
    if (!notification_id) {
      return new Response(JSON.stringify({ error: "Missing notification_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: notif } = await supabase
      .from("notifications")
      .select("id, user_id, tenant_id, title, message, type, reference_type, reference_id")
      .eq("id", notification_id)
      .maybeSingle();

    if (!notif?.user_id) {
      return new Response(JSON.stringify({ message: "Notification not found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subs } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth")
      .eq("user_id", notif.user_id);

    if (!subs || subs.length === 0) {
      return new Response(JSON.stringify({ message: "No subscriptions" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const route = referenceRoutes[notif.reference_type || notif.type] || "/";
    const payload = JSON.stringify({
      title: notif.title || "New Notification",
      message: notif.message || "",
      url: route,
      tag: `notif-${notif.id}`,
    });

    let sent = 0;
    const toDelete: string[] = [];

    await Promise.all(subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          payload,
        );
        sent++;
      } catch (err: any) {
        const status = err?.statusCode;
        if (status === 404 || status === 410) toDelete.push(s.id);
        else console.error("push send error:", status, err?.body);
      }
    }));

    if (toDelete.length) {
      await supabase.from("push_subscriptions").delete().in("id", toDelete);
    }

    return new Response(JSON.stringify({ sent, removed: toDelete.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("send-push error:", e);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
