// Sends the Children's Church pickup PIN to recipient members
// across in-app notifications, email, and SMS using service role
// (bypasses notifications RLS which only admins/unit_leaders can insert).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const {
      tenant_id,
      pin,
      recipient_member_ids,
      child_first_names,
    }: {
      tenant_id?: string;
      pin?: string;
      recipient_member_ids?: string[];
      child_first_names?: string[];
    } = await req.json();

    if (!tenant_id || !pin || !Array.isArray(recipient_member_ids) || recipient_member_ids.length === 0) {
      return new Response(
        JSON.stringify({ error: "tenant_id, pin, and recipient_member_ids are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    if (typeof pin !== "string" || pin.length !== 6) {
      return new Response(JSON.stringify({ error: "PIN must be 6 digits" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Validate caller is signed in and is a CC worker/admin for this tenant
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: ures } = await admin.auth.getUser(token);
    const caller = ures?.user;
    if (!caller) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const [{ data: isCcWorker }, { data: isAdmin }] = await Promise.all([
      admin.rpc("is_children_church_member", { _user_id: caller.id, _tenant_id: tenant_id }),
      admin.rpc("is_admin", { _user_id: caller.id, _tenant_id: tenant_id }),
    ]);
    if (!isCcWorker && !isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dedupedIds = Array.from(new Set(recipient_member_ids));
    const { data: recipients, error: recErr } = await admin
      .from("members")
      .select("id, user_id, first_name, email, phone")
      .eq("tenant_id", tenant_id)
      .in("id", dedupedIds);
    if (recErr) throw recErr;

    const childNames = (child_first_names || []).join(", ").slice(0, 120) || "your child";

    let notified = 0;
    let emailed = 0;
    let smsed = 0;
    const errors: Array<{ member_id: string; channel: string; error: string }> = [];

    // In-app notifications (one row per user_id)
    const notifRows = (recipients || [])
      .filter((r) => r.user_id)
      .map((r) => ({
        user_id: r.user_id,
        tenant_id,
        title: `Pickup code for ${childNames}`,
        message: `Your pickup PIN is ${pin}. Show this at pickup. Do not share.`,
        type: "children_church",
        reference_type: "children_church",
      }));
    if (notifRows.length) {
      const { error: nErr } = await admin.from("notifications").insert(notifRows);
      if (nErr) {
        errors.push({ member_id: "*", channel: "in_app", error: nErr.message });
      } else {
        notified = notifRows.length;
      }
    }

    // Resolve tenant sender name for branded "from"
    let tenantSenderName = "Church";
    try {
      const { data: t } = await admin.from("tenants").select("name").eq("id", tenant_id).maybeSingle();
      if (t?.name) tenantSenderName = String(t.name);
    } catch { /* ignore */ }
    const senderDomain = "notify.app.churchmanagementsuite.org";
    const fromDomain = "app.churchmanagementsuite.org";
    const safeName = tenantSenderName.replace(/[",\\]/g, "");
    const fromAddress = `"${safeName}" <noreply@${fromDomain}>`;

    const escHtml = (s: string) =>
      s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    // Pre-load suppressed emails
    const { data: suppressed } = await admin.from("suppressed_emails").select("email");
    const suppressedSet = new Set((suppressed || []).map((s: { email: string }) => s.email.toLowerCase()));

    for (const adult of recipients || []) {
      const firstName = adult.first_name || "there";

      if (adult.email && !suppressedSet.has(adult.email.toLowerCase())) {
        try {
          // Get-or-create unsubscribe token
          const normEmail = adult.email.trim().toLowerCase();
          let unsubscribeToken: string;
          const { data: existingTok } = await admin
            .from("email_unsubscribe_tokens")
            .select("token")
            .eq("email", normEmail)
            .is("used_at", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (existingTok?.token) {
            unsubscribeToken = existingTok.token;
          } else {
            unsubscribeToken = crypto.randomUUID();
            const { error: tErr } = await admin
              .from("email_unsubscribe_tokens")
              .insert({ email: normEmail, token: unsubscribeToken });
            if (tErr) throw tErr;
          }

          const subject = "Children's Church Pickup PIN";
          const body =
            `Hi ${firstName},\n\n` +
            `${childNames} has been checked in to Children's Church.\n\n` +
            `Your pickup PIN is: ${pin}\n\n` +
            `Please keep this PIN private and show it at pickup. ` +
            `It will be required to collect your child.\n\nThank you.`;

          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 16px;"><tr><td align="center">
    <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;">
      <tr><td style="background:#1a2d4d;padding:24px 32px;text-align:center;">
        <h1 style="margin:0;color:#fff;font-size:20px;font-weight:700;">${escHtml(tenantSenderName)}</h1>
      </td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${escHtml(firstName)},</p>
        <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">${escHtml(subject)}</h2>
        <div style="margin:0 0 16px;color:#555;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escHtml(body)}</div>
        <div style="margin:24px 0;text-align:center;">
          <div style="display:inline-block;padding:16px 32px;background:#1a2d4d;color:#fff;font-size:28px;letter-spacing:6px;font-weight:700;border-radius:6px;">${escHtml(pin)}</div>
        </div>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

          const messageId = `pickup-pin-${crypto.randomUUID()}`;
          const payload = {
            to: adult.email,
            from: fromAddress,
            sender_domain: senderDomain,
            subject,
            html,
            text: `Dear ${firstName},\n\n${subject}\n\n${body}\n\n${tenantSenderName}`,
            purpose: "transactional",
            label: "children-church-pickup-pin",
            message_id: messageId,
            idempotency_key: messageId,
            unsubscribe_token: unsubscribeToken,
            queued_at: new Date().toISOString(),
            tenant_id,
          };

          const { error: enqueueErr } = await admin.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload,
          });
          if (enqueueErr) throw enqueueErr;

          await admin.from("email_send_log").insert({
            message_id: messageId,
            template_name: "children-church-pickup-pin",
            recipient_email: adult.email,
            status: "pending",
            tenant_id,
          });

          emailed++;
        } catch (err) {
          errors.push({ member_id: adult.id, channel: "email", error: String((err as Error)?.message || err) });
        }
      }


      if (adult.phone) {
        try {
          const res = await fetch(`${SUPABASE_URL}/functions/v1/send-sms`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
            },
            body: JSON.stringify({
              recipients: [{ phone: adult.phone, member_id: adult.id }],
              message:
                `Children's Church: ${childNames} checked in. ` +
                `Pickup PIN: ${pin}. Keep private — needed at pickup.`,
              sms_type: "children_church",
              reference_id: null,
              channel: "sms",
              tenant_id,
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`send-sms ${res.status}: ${txt.slice(0, 200)}`);
          }
          smsed++;
        } catch (err) {
          errors.push({ member_id: adult.id, channel: "sms", error: String((err as Error)?.message || err) });
        }
      }
    }

    return new Response(
      JSON.stringify({ notified, emailed, smsed, recipients: recipients?.length || 0, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String((err as Error)?.message || err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
