import { createClient } from "npm:@supabase/supabase-js@2";

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
  tenant_id?: string;
  member_id?: string;
  request_type?: "unit" | "home_cell";
  unit_name?: string | null;
  wsf_centre_id?: string | null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Allow either authenticated user OR service role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    if (token !== serviceKey) {
      // Verify it's a valid user JWT
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
    }

    const supabase = createClient(supabaseUrl, serviceKey);
    const body = (await req.json()) as ReqBody;
    const { request_id, tenant_id, member_id, request_type, unit_name, wsf_centre_id } = body;

    if (!tenant_id || !member_id || !request_type) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tenant branding
    let churchName = "Church Management Suite";
    let churchShortName = churchName;
    {
      const { data: tenantRow } = await supabase
        .from("tenants")
        .select("name, settings")
        .eq("id", tenant_id)
        .single();
      if (tenantRow) {
        const s = tenantRow.settings as Record<string, unknown> | null;
        churchName = ((s?.email_sender_name as string) || tenantRow.name || churchName) as string;
        churchShortName = churchName;
      }
    }

    // Member info
    const { data: member } = await supabase
      .from("members")
      .select("first_name, last_name")
      .eq("id", member_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    const memberName = `${member?.first_name || ""} ${member?.last_name || ""}`.trim() || "A member";

    // Resolve target label & approver user_ids
    let targetLabel = "your group";
    const approverUserIds = new Set<string>();

    if (request_type === "unit" && unit_name) {
      targetLabel = unit_name;
      // Find unit leaders for this unit
      const { data: leaders } = await supabase
        .from("unit_leader_assignments")
        .select("user_id, unit_name")
        .eq("tenant_id", tenant_id);
      (leaders || []).forEach((l) => {
        if ((l.unit_name || "").trim().toLowerCase() === unit_name.trim().toLowerCase()) {
          if (l.user_id) approverUserIds.add(l.user_id);
        }
      });
    } else if (request_type === "home_cell" && wsf_centre_id) {
      const { data: centre } = await supabase
        .from("wsf_centres")
        .select("name, leader_id")
        .eq("id", wsf_centre_id)
        .eq("tenant_id", tenant_id)
        .maybeSingle();
      targetLabel = centre?.name || "Home Cell";
      if (centre?.leader_id) {
        const { data: leaderMember } = await supabase
          .from("members")
          .select("user_id")
          .eq("id", centre.leader_id)
          .maybeSingle();
        if (leaderMember?.user_id) approverUserIds.add(leaderMember.user_id);
      }
    }

    // Add tenant admins as fallback approvers
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .in("role", ["admin", "super_admin"]);
    (adminRoles || []).forEach((r) => r.user_id && approverUserIds.add(r.user_id));
    const { data: ownerMems } = await supabase
      .from("tenant_memberships")
      .select("user_id")
      .eq("tenant_id", tenant_id)
      .in("role", ["owner", "admin"]);
    (ownerMems || []).forEach((r) => r.user_id && approverUserIds.add(r.user_id));

    if (approverUserIds.size === 0) {
      return new Response(JSON.stringify({ message: "No approvers found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Create in-app notifications for each approver
    const notifRows = Array.from(approverUserIds).map((uid) => ({
      user_id: uid,
      tenant_id,
      title: "New Join Request",
      message: `${memberName} is requesting to join ${targetLabel}.`,
      type: "general",
      reference_id: request_id || null,
      reference_type: "unit_join_request",
    }));
    if (notifRows.length > 0) {
      await supabase.from("notifications").insert(notifRows);
    }

    // 2. Email + SMS each approver
    const senderDomain = "notify.app.churchmanagementsuite.org";
    const fromAddress = `${churchShortName} <noreply@${senderDomain}>`;
    const subject = `New Join Request: ${targetLabel}`;

    // Fetch contact info for approvers
    const approverIds = Array.from(approverUserIds);
    const { data: profiles } = await supabase
      .from("profiles")
      .select("user_id, full_name, email")
      .in("user_id", approverIds)
      .eq("tenant_id", tenant_id);
    const { data: leaderMembers } = await supabase
      .from("members")
      .select("user_id, first_name, phone, email")
      .in("user_id", approverIds)
      .eq("tenant_id", tenant_id);

    const profMap = new Map((profiles || []).map((p) => [p.user_id, p]));
    const memMap = new Map((leaderMembers || []).map((m) => [m.user_id, m]));

    // SMS toggle
    const { data: smsSetting } = await supabase
      .from("app_settings")
      .select("value")
      .eq("key", "sms_notifications_enabled")
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    const smsEnabled = smsSetting?.value === true || smsSetting === null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");

    for (const uid of approverIds) {
      const prof = profMap.get(uid);
      const mem = memMap.get(uid);
      const recipientEmail = prof?.email || mem?.email;
      const recipientPhone = mem?.phone;
      const recipientName = prof?.full_name || mem?.first_name || "Leader";

      // Email
      if (recipientEmail) {
        const messageId = `join-req-${request_id || crypto.randomUUID()}-${uid}`;
        const normalizedEmail = recipientEmail.trim().toLowerCase();

        // Get or create unsubscribe token (one per email address)
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
              // Race: re-read
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
          <p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${escHtml(recipientName)},</p>
          <h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">New Join Request</h2>
          <div style="background:#f0f4f8;border-radius:8px;padding:16px;margin:0 0 24px;">
            <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Member:</strong> ${escHtml(memberName)}</p>
            <p style="margin:0 0 8px;color:#555;font-size:14px;"><strong>Wants to join:</strong> ${escHtml(targetLabel)}</p>
            <p style="margin:0;color:#555;font-size:14px;"><strong>Type:</strong> ${request_type === "unit" ? "Church Unit" : "Home Cell"}</p>
          </div>
          <p style="margin:0 0 16px;color:#555;font-size:15px;">Please log in to approve or decline this request from your dashboard.</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;">
          <p style="margin:0;color:#999;font-size:12px;text-align:center;">Automated notification — ${escHtml(churchName)}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
        const text = `Hi ${recipientName},\n\n${memberName} is requesting to join ${targetLabel} (${request_type === "unit" ? "Unit" : "Home Cell"}).\n\nPlease log in to approve or decline.\n\n${churchName}`;

        const payload = {
          to: recipientEmail,
          from: fromAddress,
          sender_domain: senderDomain,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "join-request-notification",
          message_id: messageId,
          idempotency_key: messageId,
          queued_at: new Date().toISOString(),
          tenant_id,
        };
        const { error: enqErr } = await supabase.rpc("enqueue_email", {
          queue_name: "transactional_emails",
          payload,
        });
        if (enqErr) {
          console.error("enqueue join-request email failed:", enqErr);
        } else {
          await supabase.from("email_send_log").insert({
            message_id: messageId,
            template_name: "join-request-notification",
            recipient_email: recipientEmail,
            status: "pending",
            tenant_id,
          });
        }
      }

      // SMS
      if (recipientPhone && smsEnabled && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
        let cleaned = recipientPhone.replace(/[\s\-\(\)\.]/g, "");
        if (/^0[1-9]\d{9,10}$/.test(cleaned)) cleaned = "+44" + cleaned.slice(1);
        if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
        if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
          const smsBody = `Hi ${recipientName}, ${memberName} is requesting to join ${targetLabel}. Please review on your dashboard. - ${churchShortName}`;
          try {
            const webhookUrl = `${supabaseUrl}/functions/v1/twilio-webhook`;
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
              sender_id: uid,
              recipient_phone: cleaned,
              message: smsBody,
              sms_type: "join-request-notification",
              reference_id: request_id || null,
              status: response.ok ? "sent" : "failed",
              message_sid: data.sid || null,
              error_message: response.ok ? null : data.message || JSON.stringify(data),
              delivery_status: response.ok ? "queued" : null,
              tenant_id,
            });
          } catch (err) {
            console.error("Join-request SMS error:", err);
          }
        }
      }
    }

    return new Response(JSON.stringify({ success: true, notified: approverIds.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-join-request error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
