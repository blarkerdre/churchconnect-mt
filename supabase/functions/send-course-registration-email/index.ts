import * as React from "npm:react@18.3.1";
import { renderAsync } from "npm:@react-email/components@0.0.22";
import { sendLovableEmail } from "npm:@lovable.dev/email-js";
import { createClient } from "npm:@supabase/supabase-js@2";
import { WoFBICourseRegistrationEmail } from "../_shared/email-templates/wofbi-course-registration.tsx";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SITE_NAME = "mychurchconnect";
const SENDER_DOMAIN = "notify.app.churchmanagementsuite.org";
const FROM_DOMAIN = "app.churchmanagementsuite.org";
const ROOT_DOMAIN = "app.churchmanagementsuite.org";

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

async function getOrCreateUnsubscribeToken(
  supabase: ReturnType<typeof createClient>,
  email: string,
) {
  const normalizedEmail = normalizeEmail(email);

  const { data: existingToken, error: tokenLookupError } = await supabase
    .from("email_unsubscribe_tokens")
    .select("token")
    .eq("email", normalizedEmail)
    .is("used_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (tokenLookupError) throw tokenLookupError;
  if (existingToken?.token) return existingToken.token;

  const token = crypto.randomUUID();
  const { error: tokenInsertError } = await supabase
    .from("email_unsubscribe_tokens")
    .insert({ email: normalizedEmail, token });

  if (tokenInsertError) throw tokenInsertError;
  return token;
}

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
    const authHeader = req.headers.get("Authorization");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    if (!authHeader || authHeader !== `Bearer ${serviceRoleKey}`) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { email, first_name, course_name, tenant_id } = await req.json();

    if (!email || typeof email !== "string") {
      return new Response(JSON.stringify({ error: "Email is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceRoleKey,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Fetch tenant sender name
    let senderName = SITE_NAME;
    if (tenant_id) {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("name, settings")
        .eq("id", tenant_id)
        .single();
      if (tenantRow) {
        const s = tenantRow.settings as Record<string, unknown> | null;
        senderName = (s?.email_sender_name as string) || tenantRow.name || senderName;
      }
    }

    // Resolve tenant slug for tenant-scoped URL
    let tenantSiteUrl = `https://${ROOT_DOMAIN}`;
    if (tenant_id) {
      const { data: tenantSlugRow } = await supabase
        .from("tenants")
        .select("slug")
        .eq("id", tenant_id)
        .maybeSingle();
      if (tenantSlugRow?.slug) {
        tenantSiteUrl = `https://${ROOT_DOMAIN}/t/${tenantSlugRow.slug}`;
      }
    }

    const templateProps = {
      firstName: first_name || "Friend",
      courseName: course_name || "Bible School Course",
      siteUrl: tenantSiteUrl,
    };

    const [html, text, unsubscribeToken] = await Promise.all([
      renderAsync(React.createElement(WoFBICourseRegistrationEmail, templateProps)),
      renderAsync(React.createElement(WoFBICourseRegistrationEmail, templateProps), {
        plainText: true,
      }),
      getOrCreateUnsubscribeToken(supabase, normalizedEmail),
    ]);

    const messageId = crypto.randomUUID();

    await supabase.from("email_send_log").insert({
      message_id: messageId,
      template_name: "course-registration",
      recipient_email: normalizedEmail,
      status: "pending",
    });

    if (!apiKey) {
      console.error("Missing LOVABLE_API_KEY");
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "course-registration",
        recipient_email: normalizedEmail,
        status: "failed",
        error_message: "Missing LOVABLE_API_KEY",
      });
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    try {
      await sendLovableEmail(
        {
          to: normalizedEmail,
          from: `"${senderName.replace(/"/g, '')}" <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `Registration Confirmed: ${course_name || "WoFBI Course"}`,
          html,
          text,
          purpose: "transactional",
          label: "course-registration",
          unsubscribe_token: unsubscribeToken,
          message_id: messageId,
          idempotency_key: messageId,
        },
        { apiKey, sendUrl: Deno.env.get("LOVABLE_SEND_URL") },
      );

      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "course-registration",
        recipient_email: normalizedEmail,
        status: "sent",
      });

      console.log("Course registration email sent", { email: normalizedEmail, messageId, course_name });

      return new Response(JSON.stringify({ success: true, message_id: messageId }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (sendErr) {
      const errMsg = sendErr instanceof Error ? sendErr.message : String(sendErr);
      console.error("Failed to send course registration email", { error: errMsg });
      await supabase.from("email_send_log").insert({
        message_id: messageId,
        template_name: "course-registration",
        recipient_email: normalizedEmail,
        status: "failed",
        error_message: errMsg.slice(0, 1000),
      });
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  } catch (err) {
    console.error("Send course registration email error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
