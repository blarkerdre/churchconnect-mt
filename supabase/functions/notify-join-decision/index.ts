import { createClient } from "npm:@supabase/supabase-js@2";
import { checkSmsQuota } from "../_shared/sms-quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function escHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

interface ReqBody {
  request_id?: string;
  decision?: "approved" | "declined";
  reason?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    let callerUserId: string | null = null;
    if (token !== serviceKey) {
      const authClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
        auth: { autoRefreshToken: false, persistSession: false },
      });
      const { data, error } = await authClient.auth.getUser(token);
      if (error || !data?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      callerUserId = data.user.id;
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as ReqBody;
    const { request_id, decision, reason } = body;

    if (!request_id || !decision || !["approved", "declined"].includes(decision)) {
      return new Response(JSON.stringify({ error: "Missing or invalid fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load the request
    const { data: jr, error: jrErr } = await supabase
      .from("unit_join_requests")
      .select("id, tenant_id, member_id, request_type, unit_name, wsf_centre_id, status, decline_reason")
      .eq("id", request_id)
      .maybeSingle();
    if (jrErr || !jr) {
      return new Response(JSON.stringify({ error: "Request not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (jr.status !== decision) {
      return new Response(
        JSON.stringify({ error: `Request status (${jr.status}) does not match decision (${decision})` }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Authorization: caller must be admin / unit leader / home cell leader for this request
    if (callerUserId) {
      const { data: isAdmin } = await supabase.rpc("is_admin", {
        _user_id: callerUserId,
        _tenant_id: jr.tenant_id,
      });
      let allowed = !!isAdmin;
      if (!allowed && jr.request_type === "unit" && jr.unit_name) {
        const { data: ok } = await supabase.rpc("is_unit_leader_for_session", {
          _user_id: callerUserId,
          _unit_name: jr.unit_name,
          _tenant_id: jr.tenant_id,
        });
        allowed = !!ok;
      }
      if (!allowed && jr.request_type === "home_cell" && jr.wsf_centre_id) {
        const { data: ok } = await supabase.rpc("is_home_cell_leader_for_centre", {
          _user_id: callerUserId,
          _centre_id: jr.wsf_centre_id,
          _tenant_id: jr.tenant_id,
        });
        allowed = !!ok;
      }
      if (!allowed) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Tenant branding
    let churchName = "Church Management Suite";
    let churchShortName = churchName;
    {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("name, settings")
        .eq("id", jr.tenant_id)
        .single();
      if (tenantRow) {
        const s = tenantRow.settings as Record<string, unknown> | null;
        churchName = ((s?.email_sender_name as string) || tenantRow.name || churchName) as string;
        churchShortName = churchName;
      }
    }

    // Member contact info
    const { data: member } = await supabase
      .from("members")
      .select("first_name, last_name, email, phone, user_id")
      .eq("id", jr.member_id)
      .eq("tenant_id", jr.tenant_id)
      .maybeSingle();

    if (!member) {
      return new Response(JSON.stringify({ error: "Member not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Member";
    const firstName = member.first_name || "Member";

    // Resolve target label
    let targetLabel = "your group";
    if (jr.request_type === "unit" && jr.unit_name) {
      targetLabel = jr.unit_name;
    } else if (jr.request_type === "home_cell" && jr.wsf_centre_id) {
      const { data: centre } = await supabase
        .from("wsf_centres")
        .select("name")
        .eq("id", jr.wsf_centre_id)
        .maybeSingle();
      targetLabel = centre?.name || "Home Cell";
    }

    // Profile email fallback
    let recipientEmail: string | null = member.email || null;
    if (!recipientEmail && member.user_id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_id", member.user_id)
        .eq("tenant_id", jr.tenant_id)
        .maybeSingle();
      recipientEmail = prof?.email || null;
    }
    const recipientPhone = member.phone || null;

    const declineReason = (reason ?? jr.decline_reason ?? "").toString().trim();
    const approved = decision === "approved";
    const verb = approved ? "approved" : "declined";
    const subject = approved
      ? `Your request to join ${targetLabel} was approved`
      : `Your request to join ${targetLabel} was declined`;
    const messageId = `join-decision-${jr.id}-${decision}`;

    let emailQueued = false;
    let smsSent = false;

    // EMAIL
    if (recipientEmail) {
      const normalizedEmail = recipientEmail.trim().toLowerCase();

      // Suppression check
      const { data: suppressed } = await supabase
        .from("suppressed_emails")
        .select("email")
        .eq("email", normalizedEmail)
        .maybeSingle();

      if (!suppressed) {
        // Get/create unsubscribe token
        let unsubscribeToken: string | null = null;
        {
          const { data: existing } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", normalizedEmail)
            .is("used_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existing?.token) {
            unsubscribeToken = existing.token;
          } else {
            const newToken = crypto.randomUUID();
            const { error: insErr } = await supabase
              .from("email_unsubscribe_tokens")
              .insert({ email: normalizedEmail, token: newToken });
            if (insErr) {
              const { data: again } = await supabase
                .from("email_unsubscribe_tokens")
                .select("token")
                .eq("email", normalizedEmail)
                .is("used_at", null)
                .order("created_at", { ascending: false })
                .limit(1)
                .maybeSingle();
              unsubscribeToken = again?.token || newToken;
            } else {
              unsubscribeToken = newToken;
            }
          }
        }

        const senderDomain = "notify.app.churchmanagementsuite.org";
        const needsQuoting = /[",;:<>@()\[\]\\]/.test(churchShortName);
        const safeDisplayName = needsQuoting
          ? `"${churchShortName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
          : churchShortName;
        const fromAddress = `${safeDisplayName} <noreply@${senderDomain}>`;

        const accentColor = approved ? "#16a34a" : "#dc2626";
        const headlineEmoji = approved ? "✅" : "ℹ️";
        const reasonBlock = !approved && declineReason
          ? `<div style="background:#fef2f2;border-left:4px solid #dc2626;border-radius:6px;padding:12px 16px;margin:0 0 24px;">
              <p style="margin:0 0 4px;color:#7f1d1d;font-size:13px;font-weight:600;">Reason</p>
              <p style="margin:0;color:#555;font-size:14px;line-height:1.5;">${escHtml(declineReason)}</p>
            </div>`
          : "";
        const bodyParagraph = approved
          ? `Great news! Your request to join <strong>${escHtml(targetLabel)}</strong> has been approved. You're now part of the group — welcome!`
          : `We're sorry to let you know that your request to join <strong>${escHtml(targetLabel)}</strong> was not approved at this time.`;

        const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background-color:#f4f5f7;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;">
        <tr><td style="background:#1a2d4d;padding:24px 32px;text-align:center;">
          <h1 style="margin:0;color:#fff;font-size:20px;">${escHtml(churchName)}</h1>
        </td></tr>
        <tr><td style="padding:32px;">
          <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${escHtml(firstName)},</p>
          <h2 style="margin:0 0 16px;color:${accentColor};font-size:18px;">${headlineEmoji} Join Request ${approved ? "Approved" : "Declined"}</h2>
          <p style="margin:0 0 20px;color:#555;font-size:15px;line-height:1.6;">${bodyParagraph}</p>
          ${reasonBlock}
          <p style="margin:0 0 16px;color:#555;font-size:14px;">${approved ? "You can view your updated profile and units in the app." : "If you'd like to discuss this further, please reach out to your church leadership."}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">Automated notification — ${escHtml(churchName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

        const text = approved
          ? `Hi ${firstName},\n\nGreat news! Your request to join ${targetLabel} has been ${verb}. Welcome!\n\n— ${churchName}`
          : `Hi ${firstName},\n\nYour request to join ${targetLabel} was ${verb}.${declineReason ? `\n\nReason: ${declineReason}` : ""}\n\nIf you'd like to discuss this further, please reach out to your church leadership.\n\n— ${churchName}`;

        const payload = {
          to: recipientEmail,
          from: fromAddress,
          sender_domain: senderDomain,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "join-request-decision",
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
          tenant_id: jr.tenant_id,
          unsubscribe_token: unsubscribeToken,
        };
        const { error: enqErr } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload,
        });
        if (enqErr) {
          console.error("enqueue join-decision email failed:", enqErr);
        } else {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: "join-request-decision",
            recipient_email: recipientEmail,
            status: "pending",
            tenant_id: jr.tenant_id,
          });
          emailQueued = true;
        }
      }
    }

    // SMS
    if (recipientPhone) {
      const { data: smsSetting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "sms_notifications_enabled")
        .eq("tenant_id", jr.tenant_id)
        .maybeSingle();
      const smsEnabled = smsSetting?.value === true || smsSetting === null;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
      const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

      if (smsEnabled && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
        let cleaned = recipientPhone.replace(/[\s\-\(\)\.]/g, "");
        if (/^0[1-9]\d{9,10}$/.test(cleaned)) cleaned = "+44" + cleaned.slice(1);
        if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
        if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
          const smsBody = approved
            ? `Hi ${firstName}, your request to join ${targetLabel} has been approved. Welcome! - ${churchShortName}`
            : `Hi ${firstName}, your request to join ${targetLabel} was declined.${declineReason ? ` Reason: ${declineReason}` : ""} - ${churchShortName}`;
          try {
            const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
            const __quota = await checkSmsQuota(supabase, jr.tenant_id, "sms", 1);
            if (!__quota.allowed) {
              console.warn("[notify-join-decision] SMS quota exceeded for tenant", jr.tenant_id, "— skipping send");
            } else {
            const response = await fetch(`${GATEWAY_URL}/Messages.json`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${LOVABLE_API_KEY}`,
                "X-Connection-Api-Key": TWILIO_API_KEY,
                "Content-Type": "application/x-www-form-urlencoded",
              },
              body: new URLSearchParams({
                To: cleaned,
                From: TWILIO_FROM,
                Body: smsBody,
                StatusCallback: webhookUrl,
              }),
            });
            const data = await response.json();
            await supabase.from("sms_log").insert({
              sender_id: callerUserId,
              recipient_phone: cleaned,
              message: smsBody,
              sms_type: "join-request-decision",
              reference_id: jr.id,
              status: response.ok ? "sent" : "failed",
              message_sid: data.sid || null,
              error_message: response.ok ? null : data.message || JSON.stringify(data),
              delivery_status: response.ok ? "queued" : null,
              tenant_id: jr.tenant_id,
            });
            }
            smsSent = response.ok;
          } catch (err) {
            console.error("Join-decision SMS error:", err);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, email_queued: emailQueued, sms_sent: smsSent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("notify-join-decision error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
