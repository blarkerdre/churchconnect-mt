import { createClient } from "npm:@supabase/supabase-js@2";
import { sendRawManagedEmail } from "../_shared/managed-email.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SENDER_DOMAIN = "notify.app.churchmanagementsuite.org";
const FROM_DOMAIN = "app.churchmanagementsuite.org";

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Validate caller's auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const callerId = userData.user.id;

    const { tenant_id, member_name, title, situation, action, god_did, share_publicly, sender_email } = await req.json();
    // Always derive user_id from the verified JWT — never trust the client
    const user_id = callerId;

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!title?.trim() || !situation?.trim() || !action?.trim() || !god_did?.trim()) {
      return new Response(JSON.stringify({ error: "All testimony fields are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Confirm caller belongs to tenant
    const { data: belongs } = await supabase.rpc("user_belongs_to_tenant", {
      _user_id: callerId,
      _tenant_id: tenant_id,
    });
    if (!belongs) {
      return new Response(JSON.stringify({ error: "Forbidden: not a member of this tenant" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Save testimony (user_id is always the verified caller)
    const { error: insertErr } = await supabase.from("testimonies").insert({
      tenant_id,
      user_id,
      member_name: member_name?.trim() || "Anonymous",
      title: title.trim(),
      situation: situation.trim(),
      action: action.trim(),
      god_did: god_did.trim(),
      share_publicly: !!share_publicly,
    });
    if (insertErr) {
      console.error("Failed to save testimony", insertErr);
      return new Response(JSON.stringify({ error: "Failed to save testimony" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Recipient email
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "testimony_recipient_email")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const recipientEmail = typeof setting?.value === "string" ? setting.value : null;
    if (!recipientEmail) {
      // Testimony is saved; just no email destination configured
      return new Response(JSON.stringify({ success: true, emailed: false, reason: "no_recipient_configured" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant for branding
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name, settings")
      .eq("id", tenant_id)
      .single();

    const churchName = tenant?.name || "Church";
    const senderName = (tenant?.settings as Record<string, unknown> | null)?.email_sender_name as string
      || churchName;
    const safeName = String(senderName).replace(/[",\\]/g, "");
    const fromAddress = `"${safeName}" <noreply@${FROM_DOMAIN}>`;
    const name = member_name?.trim() || "Anonymous";

    const htmlBody = `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
        <h2 style="color:#1a2d4d;margin-bottom:4px;">New Testimony: ${escapeHtml(title.trim())}</h2>
        <p style="color:#666;font-size:14px;margin-top:0;">From <strong>${escapeHtml(name)}</strong>${sender_email ? ` (${escapeHtml(sender_email)})` : ""} at ${escapeHtml(churchName)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <h3 style="color:#1a2d4d;font-size:15px;">What was the situation?</h3>
        <p style="font-size:14px;color:#333;white-space:pre-wrap;">${escapeHtml(situation)}</p>
        <h3 style="color:#1a2d4d;font-size:15px;">What did you do?</h3>
        <p style="font-size:14px;color:#333;white-space:pre-wrap;">${escapeHtml(action)}</p>
        <h3 style="color:#1a2d4d;font-size:15px;">What has the Lord done?</h3>
        <p style="font-size:14px;color:#333;white-space:pre-wrap;">${escapeHtml(god_did)}</p>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:16px 0;" />
        <p style="font-size:14px;color:${share_publicly ? '#16a34a' : '#dc2626'};font-weight:600;">
          ${share_publicly ? 'Member has consented to this testimony being shared publicly.' : 'Member prefers this testimony to remain private.'}
        </p>
      </div>
    `;
    const textBody = `New Testimony: ${title.trim()}\nFrom: ${name}${sender_email ? ` (${sender_email})` : ""}\n\nSituation:\n${situation}\n\nAction:\n${action}\n\nWhat the Lord did:\n${god_did}\n\n${share_publicly ? "Shared publicly." : "Private."}`;

    const messageId = `testimony-${crypto.randomUUID()}`;
    const subject = `New Testimony from ${name}: ${title.trim()}`;

    try {
      await sendRawManagedEmail({
        supabase,
        to: recipientEmail,
        subject,
        html: htmlBody,
        text: textBody,
        label: "testimony",
        idempotencyKey: messageId,
        tenantId: tenant_id,
        messageId,
        fromName: safeName,
      });
    } catch (sendErr) {
      console.error("Failed to send testimony email", sendErr);
      return new Response(JSON.stringify({ error: "Failed to queue email" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, emailed: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-testimony error", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
