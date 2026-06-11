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

    const { task_id, tenant_id } = await req.json();
    if (!task_id) {
      return new Response(JSON.stringify({ error: "task_id required" }), {
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
      const { data: isSuper } = await supabase.rpc("has_role", { _user_id: user.id, _role: "super_admin" });
      const { data: isAdminFlag } = await supabase.rpc("is_admin", { _user_id: user.id, _tenant_id: tenant_id });
      const { data: isLeader } = await supabase.rpc("has_role", { _user_id: user.id, _role: "unit_leader" });
      if (!isSuper && !isAdminFlag && !isLeader) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const { data: task, error: taskErr } = await supabase
      .from("unit_tasks").select("*").eq("id", task_id).single();
    if (taskErr || !task) {
      return new Response(JSON.stringify({ error: "Task not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: assignments = [] } = await supabase
      .from("unit_task_assignments")
      .select("user_id, member_id")
      .eq("task_id", task_id);

    // Tenant branding
    let churchName = "Church Management Suite";
    let churchShort = churchName;
    if (task.tenant_id) {
      const { data: t } = await supabase.from("tenants")
        .select("name, settings").eq("id", task.tenant_id).single();
      if (t) {
        const s = (t.settings as Record<string, unknown> | null) || {};
        churchName = (s.email_sender_name as string) || t.name || churchName;
        churchShort = churchName;
      }
    }

    // SMS toggle
    const { data: smsSetting } = await supabase
      .from("app_settings").select("value")
      .eq("key", "sms_notifications_enabled")
      .eq("tenant_id", task.tenant_id).maybeSingle();
    const smsEnabled = smsSetting?.value === true || smsSetting === null;

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const TWILIO_API_KEY = Deno.env.get("TWILIO_API_KEY");
    const TWILIO_FROM = Deno.env.get("TWILIO_FROM_NUMBER");
    const senderDomain = "notify.app.churchmanagementsuite.org";
    const safeFromName = `"${String(churchShort).replace(/[\\"]/g, "\\$&")}"`;
    const fromAddress = `${safeFromName} <noreply@${senderDomain}>`;

    let sent = 0;
    for (const a of (assignments as Array<{ user_id: string | null; member_id: string | null }>)) {
      try {
        // Resolve contact info
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
        if (a.member_id) {
          const { data: m } = await supabase.from("members")
            .select("email, phone, first_name").eq("id", a.member_id).maybeSingle();
          if (m) {
            email = email || m.email || null;
            phone = m.phone || null;
            if (!email?.length && m.first_name) name = m.first_name;
          }
        }

        // In-app notification
        if (a.user_id) {
          await supabase.from("notifications").insert({
            user_id: a.user_id,
            tenant_id: task.tenant_id,
            type: "unit_task",
            reference_id: task.id,
            reference_type: "unit_task",
            title: `New task in ${task.unit_name}`,
            message: task.title,
          });

          // Push (best-effort)
          supabase.functions.invoke("send-push", {
            body: {
              user_id: a.user_id,
              tenant_id: task.tenant_id,
              title: `New task: ${task.title}`,
              body: `${task.unit_name}${task.due_date ? ` · due ${task.due_date}` : ""}`,
              url: "/unit-tasks",
            },
          }).catch(() => {});
        }

        // Email
        if (email) {
          const messageId = `unit-task-${task.id}-${a.user_id || a.member_id}`;
          const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px;background:#f4f5f7;"><tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:8px;overflow:hidden;">
<tr><td style="background:#1a2d4d;padding:24px 32px;text-align:center;"><h1 style="margin:0;color:#fff;font-size:20px;">${escHtml(churchName)}</h1></td></tr>
<tr><td style="padding:32px;">
<p style="margin:0 0 16px;color:#333;font-size:16px;">Dear ${escHtml(name)},</p>
<h2 style="margin:0 0 16px;color:#1a2d4d;font-size:18px;">New Unit Task Assigned</h2>
<div style="background:#f0f4f8;border-radius:8px;padding:16px;margin:0 0 24px;">
<p style="margin:0 0 6px;color:#555;font-size:14px;"><strong>Task:</strong> ${escHtml(task.title)}</p>
<p style="margin:0 0 6px;color:#555;font-size:14px;"><strong>Unit:</strong> ${escHtml(task.unit_name)}</p>
<p style="margin:0 0 6px;color:#555;font-size:14px;"><strong>Priority:</strong> ${escHtml(task.priority)}</p>
${task.due_date ? `<p style="margin:0 0 6px;color:#555;font-size:14px;"><strong>Due:</strong> ${escHtml(task.due_date)}</p>` : ""}
${task.description ? `<p style="margin:8px 0 0;color:#555;font-size:14px;">${escHtml(task.description)}</p>` : ""}
</div>
<p style="margin:0;color:#555;font-size:15px;">Please log in to acknowledge and complete this task.</p>
</td></tr></table></td></tr></table></body></html>`;

          const { error: enqErr } = await supabase.rpc("enqueue_email", {
            queue_name: "transactional_emails",
            payload: {
              to: email, from: fromAddress, sender_domain: senderDomain,
              subject: `New task: ${task.title}`,
              html, text: `New task assigned in ${task.unit_name}: ${task.title}`,
              purpose: "transactional", label: "unit-task-assignment",
              message_id: messageId, idempotency_key: messageId,
              queued_at: new Date().toISOString(),
              ...(task.tenant_id ? { tenant_id: task.tenant_id } : {}),
            },
          });
          if (!enqErr) {
            await supabase.from("email_send_log").insert({
              message_id: messageId, template_name: "unit-task-assignment",
              recipient_email: email, status: "pending", tenant_id: task.tenant_id,
            });
          }
        }

        // SMS
        if (phone && smsEnabled && LOVABLE_API_KEY && TWILIO_API_KEY && TWILIO_FROM) {
          let cleaned = phone.replace(/[\s\-\(\)\.]/g, "");
          if (/^0[1-9]\d{9,10}$/.test(cleaned)) cleaned = "+44" + cleaned.slice(1);
          if (!cleaned.startsWith("+")) cleaned = "+" + cleaned;
          if (/^\+[1-9]\d{6,14}$/.test(cleaned)) {
            const quota = await checkSmsQuota(supabase, task.tenant_id, "sms", 1);
            if (quota.allowed) {
              const body = `Hi ${name}, you have a new task in ${task.unit_name}: "${task.title}". Check the app. - ${churchShort}`;
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
                sms_type: "unit-task-assignment", reference_id: task.id,
                status: res.ok ? "sent" : "failed",
                message_sid: data.sid || null,
                error_message: res.ok ? null : (data.message || JSON.stringify(data)),
                delivery_status: res.ok ? "queued" : null,
                tenant_id: task.tenant_id,
              });
            }
          }
        }

        sent++;
      } catch (e) {
        console.error("notify-unit-task-assignment recipient error", e);
      }
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-unit-task-assignment error", e);
    return new Response(JSON.stringify({ error: "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
