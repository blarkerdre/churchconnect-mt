import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { WelcomeRegistrationEmail } from "../_shared/email-templates/welcome-registration.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_NAME = "mychurchconnect";
const SENDER_DOMAIN = "notify.churchmanagementsuite.org";
const FROM_DOMAIN = "churchmanagementsuite.org";
const ROOT_DOMAIN = "churchmanagementsuite.org";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Validate caller: only accept service role key
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, first_name, last_name } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Render email template
    const templateProps = {
      firstName: first_name || "Friend",
      lastName: last_name || "",
      siteUrl: `https://${ROOT_DOMAIN}`,
    };

    const html = await renderAsync(
      React.createElement(WelcomeRegistrationEmail, templateProps)
    );
    const text = await renderAsync(
      React.createElement(WelcomeRegistrationEmail, templateProps),
      { plainText: true }
    );

    const messageId = crypto.randomUUID();

    // Log pending
    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "welcome-registration",
      recipient_email: email,
      status: "pending",
    });

    // Enqueue to transactional_emails queue
    const { error: enqueueError } = await supabase.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        run_id: messageId,
        message_id: messageId,
        idempotency_key: messageId,
        to: email,
        from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: "Welcome to Winners Chapel International Cardiff",
        html,
        text,
        purpose: "transactional",
        label: "welcome-registration",
        queued_at: new Date().toISOString(),
      },
    });

    if (enqueueError) {
      console.error("Failed to enqueue welcome email", { error: enqueueError });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "welcome-registration",
        recipient_email: email,
        status: "failed",
        error_message: "Failed to enqueue email",
      });
      return new Response(JSON.stringify({ error: "Failed to enqueue email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Welcome email enqueued", { email, messageId });

    return new Response(JSON.stringify({ success: true, message_id: messageId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Send welcome email error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
