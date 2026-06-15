import { createClient } from "npm:@supabase/supabase-js@2";
import { checkSmsQuota } from "../_shared/sms-quota.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GATEWAY_URL = "https://connector-gateway.lovable.dev/twilio";

function escHtml(s: string): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;")
    .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const isServiceRole = token === serviceKey;
    const supabase = createClient(supabaseUrl, serviceKey);

    const { group_id, tenant_id } = await req.json();
    if (!group_id) {
      return new Response(JSON.stringify({ error: "group_id required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!isServiceRole) {
      const anon = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: { user } } = await anon.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ error: "Invalid token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: group, error: gErr } = await supabase
      .from("unit_task_groups").select("*").eq("id", group_id).single();
    if (gErr || !group) {
      return new Response(JSON.stringify({ error: "Roster not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (tenant_id && group.tenant_id !== tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant mismatch" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Tasks in this roster
    const { data: tasks = [] } = await supabase
      .from("unit_tasks")
      .select("id, title, description, due_date, priority")
      .eq("group_id", group.id)
      .eq("tenant_id", group.tenant_id);

    if (!tasks || tasks.length === 0) {
      return new Response(JSON.stringify({ success: true, sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const taskIds = tasks.map((t: any) => t.id);

    // Assignments + member info
    const { data: rawAssignments = [] } = await supabase
      .from("unit_task_assignments")
      .select("id, task_id, user_id, member_id")
      .in("task_id", taskIds)
      .eq("tenant_id", group.tenant_id);

    const memberIds = [...new Set((rawAssignments as any[]).map((a) => a.member_id).filter(Boolean))];
    const { data: memberRows = [] } = memberIds.length
      ? await supabase.from("members").select("id, first_name, last_name, email, phone").in("id", memberIds)
      : { data: [] as any[] };
    const memberById = new Map((memberRows as any[]).map((m) => [m.id, m]));
    const taskById = new Map((tasks as any[]).map((t) => [t.id, t]));

    // Build roster lines
    const rosterLines = (rawAssignments as any[]).map((a) => {
      const m = a.member_id ? memberById.get(a.member_id) : null;
      const t = taskById.get(a.task_id);
      const name = m ? `${m.first_name || ""} ${m.last_name || ""}`.trim() : "Member";
      return { name: name || "Member", title: t?.title || "Task" };
    });

    // Tenant branding
    let churchName = "Church Management Suite";
    let churchShort = churchName;
    {
      const { data: t } = await supabase.from("tenants")
        .select("name, settings").eq("id", group.tenant_id).single();
      if (t) {
        const s = (t.settings as Record<string, unknown> | null) || {};
        churchName = (s.email_sender_name as string) || t.name || churchName;
        churchShort = churchName;
      }
    }

    const { data: smsSetting } = await supabase
      .from("app_settings").select("value")
      .eq("key", "sms_notifications_enabled")
      .eq("tenant_id", group.tenant_id).maybeSingle();
    const smsEnabled = smsSetting?.value === true || smsSetting === null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    const senderDomain = "notify.app.churchmanagementsuite.org";
    const safeFromName = `"${String(churchShort).replace(/[\\"]/g, "\\$&")}"`;
    const fromAddress = `${safeFromName} <noreply@${senderDomain}>`;

    const rosterHeading = `${group.service_type} Roster — ${group.service_date}`;
    const rosterPlainList = rosterLines.map((r) => `• ${r.name} — ${r.title}`).join("\n");
    const rosterHtmlList = rosterLines
      .map((r) => `<li style="margin:4px 0;color:#444;">${escHtml(r.name)} — <strong>${escHtml(r.title)}</strong></li>`)
      .join("");

    let sent = 0;
    for (const a of rawAssignments as any[]) {
      try {
        const t = taskById.get(a.task_id);
        const m = a.member_id ? memberById.get(a.member_id) : null;

        let email: string | null = null;
        let phone: string | null = null;
        let name = "Team Member";

        if (a.user_id) {
          const { data: profile } = await supabase.from("profiles")
            .select("full_name, email").eq("user_id", a.user_id).maybeSingle();
          if (profile) {
            email = profile.email || null;
            if (profile.full_name) name = profile.full_name;
          }
        }
        if (m) {
          email = email || m.email || null;
          phone = m.phone || null;
          if (!email && m.first_name) name = m.first_name;
        }

        const myTaskTitle = t?.title || "Task";

        // In-app
        if (a.user_id) {
          await supabase.from("notifications").insert({
            user_id: a.user_id,
            tenant_id: group.tenant_id,
            type: "unit_task",
            reference_id: group.id,
            reference_type: "unit_task_group",
            title: rosterHeading,
            message: `You: ${myTaskTitle}\n${rosterPlainList}`,
          });

          supabase.functions.invoke("send-push", {
            body: {
              user_id: a.user_id,
              tenant_id: group.tenant_id,
              title: rosterHeading,
              body: `You: ${myTaskTitle} · Team of ${rosterLines.length}`,
              url: "/unit-tasks",
            },
          }).catch(() => {});
        }

        // Email
        if (email) {
          const normalizedEmail = email.trim().toLowerCase();
          let unsubscribeToken: string | null = null;
          const { data: existingToken } = await supabase
            .from("email_unsubscribe_tokens")
            .select("token").eq("email", normalizedEmail).is("used_at", null)
            .order("created_at", { ascending: false }).limit(1).maybeSingle();
          if (existingToken?.token) {
            unsubscribeToken = existingToken.token;
          } else {
            const newToken = crypto.randomUUID();
            const { error: tokErr } = await supabase
              .from("email_unsubscribe_tokens")
              .insert({ email: normalizedEmail, token: newToken });
            if (tokErr) {
              const { data: retry } = await supabase
                .from("email_unsubscribe_tokens")
                .select("token").eq("email", normalizedEmail).is("used_at", null)
                .order("created_at", { ascending: false }).limit(1).maybeSingle();
              unsubscribeToken = retry?.token || null;
            } else {
              unsubscribeToken = newToken;
            }
          }
          if (unsubscribeToken) {
            const messageId = `service-roster-${group.id}-${a.user_id || a.member_id}`;
            const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f4f5f7;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1a2d4d;padding:24px 32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:20px;">${escHtml(churchName)}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${escHtml(name)},</p>
<h2 style="margin:0 0 8px;color:#1a2d4d;font-size:18px;">${escHtml(rosterHeading)}</h2>
<p style="margin:0 0 12px;color:#555;font-size:14px;">Unit: <strong>${escHtml(group.unit_name)}</strong>${group.title ? ` · ${escHtml(group.title)}` : ""}</p>
<div style="background:#f0f4f8;border-radius:8px;padding:16px;margin:0 0 20px;">
  <p style="margin:0 0 6px;color:#1a2d4d;font-size:15px;"><strong>Your assignment:</strong> ${escHtml(myTaskTitle)}</p>
  ${t?.description ? `<p style="margin:6px 0 0;color:#555;font-size:13px;">${escHtml(t.description)}</p>` : ""}
  ${t?.due_date ? `<p style="margin:6px 0 0;color:#555;font-size:13px;">Due: ${escHtml(t.due_date)}</p>` : ""}
</div>
<p style="margin:0 0 8px;color:#1a2d4d;font-size:15px;"><strong>Full roster (${rosterLines.length} ${rosterLines.length === 1 ? "member" : "members"}):</strong></p>
<ul style="margin:0 0 20px;padding-left:20px;">${rosterHtmlList}</ul>
<p style="margin:0;color:#555;font-size:15px;">Please log in to acknowledge your assignment.</p>
</td></tr></table></td></tr></table></body></html>`;

            const textBody = `${rosterHeading}\n\nDear ${name},\n\nYour assignment: ${myTaskTitle}${t?.due_date ? ` (due ${t.due_date})` : ""}\n\nFull roster:\n${rosterPlainList}`;

            const { error: enqErr } = await supabase.rpc("enqueue_email", {
              queue_name: "transactional_emails",
              payload: {
                to: email, from: fromAddress, sender_domain: senderDomain,
                subject: rosterHeading,
                html, text: textBody,
                purpose: "transactional", label: "service-roster",
                message_id: messageId, idempotency_key: messageId,
                unsubscribe_token: unsubscribeToken,
                queued_at: new Date().toISOString(),
                tenant_id: group.tenant_id,
              },
            });
            if (!enqErr) {
              await supabase.from("email_send_log").insert({
                message_id: messageId, template_name: "service-roster",
                recipient_email: email, status: "pending", tenant_id: group.tenant_id,
              });
            }
          }
        }

        // SMS
        if (phone && smsEnabled && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
          let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
          if (/^0[1-9]\d{9,10}$/.test(cleaned)) cleaned = "+44" + cleaned.slice(1);
          if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
          if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
            const quota = await checkSmsQuota(supabase, group.tenant_id, "sms", 1);
            if (quota.allowed) {
              // Keep SMS under reasonable length
              const rosterShort = rosterLines
                .map((r) => `${r.name}:${r.title}`)
                .join("; ");
              const body = `${rosterHeading}. You: ${myTaskTitle}. Team: ${rosterShort}. - ${churchShort}`.slice(0, 480);
              const res = await fetch(`${GATEWAY_URL}/Messages.json`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${LOVABLE_API_KEY}`,
                  "X-Connection-Api-Key": TWILIO_API_KEY,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
                body: new URLSearchParams({
                  To: cleaned, From: TWILIO_FROM, Body: body,
                  StatusCallback: `${supabaseUrl}/functions/v1/twilio-webhook`,
                }),
              });
              const data = await res.json().catch(() => ({}));
              await supabase.from("sms_log").insert({
                sender_id: a.user_id, recipient_phone: cleaned, message: body,
                sms_type: "service-roster", reference_id: group.id,
                status: res.ok ? "sent" : "failed",
                message_sid: data.sid || null,
                error_message: res.ok ? null : (data.message || JSON.stringify(data)),
                delivery_status: res.ok ? "queued" : null,
                tenant_id: group.tenant_id,
              });
            }
          }
        }

        sent++;
      } catch (e) {
        console.error("notify-service-roster recipient error", e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-service-roster error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
