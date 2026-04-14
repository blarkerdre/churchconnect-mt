import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { tenant_id, member_name, title, situation, action, god_did, share_publicly, sender_email, user_id } = await req.json();

    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "tenant_id is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!title?.trim()) {
      return new Response(JSON.stringify({ error: "Title is required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!situation?.trim() || !action?.trim() || !god_did?.trim()) {
      return new Response(JSON.stringify({ error: "All three testimony fields are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Save testimony to database
    if (user_id) {
      await supabase.from("testimonies").insert({
        tenant_id,
        user_id,
        member_name: member_name?.trim() || "Anonymous",
        title: title.trim(),
        situation: situation.trim(),
        action: action.trim(),
        god_did: god_did.trim(),
        share_publicly: !!share_publicly,
      });
    }

    // Get the testimony recipient email from app_settings
    const { data: setting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "testimony_recipient_email")
      .eq("tenant_id", tenant_id)
      .maybeSingle();

    const recipientEmail = typeof setting?.value === "string" ? setting.value : null;

    if (!recipientEmail) {
      return new Response(JSON.stringify({ error: "Testimony recipient email has not been configured. Please ask your admin to set it in Settings." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant name for branding
    const { data: tenant } = await supabase
      .from("tenants")
      .select("name")
      .eq("id", tenant_id)
      .single();

    const churchName = tenant?.name || "Church";
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
          ${share_publicly ? '✅ Member has consented to this testimony being shared publicly.' : '🔒 Member prefers this testimony to remain private.'}
        </p>
        <p style="font-size:12px;color:#999;">This testimony was submitted via the church app.</p>
      </div>
    `;

    // Send via the send-email-alert function (internal call)
    const { error: sendError } = await supabase.functions.invoke("send-email-alert", {
      body: {
        tenant_id,
        to: recipientEmail,
        subject: `New Testimony from ${name}: ${title.trim()}`,
        html: htmlBody,
      },
    });

    if (sendError) throw sendError;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
