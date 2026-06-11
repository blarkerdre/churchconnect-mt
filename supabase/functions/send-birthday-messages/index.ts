// Sends birthday greetings to members across in-app, email, SMS, and WhatsApp.
// Triggered both by hourly pg_cron (no body) and manually from the UI
// (body: { tenant_id?, member_id?, channels? }).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Body {
  tenant_id?: string;
  member_id?: string;
  channels?: string[];
}

function applyVars(text: string, m: Record<string, string>): string {
  return (text || "").replace(
    /\{(first_name|last_name|church_name)\}/g,
    (_x, k) => m[k] || "",
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const svc = createClient(supabaseUrl, serviceKey);

  let body: Body = {};
  try {
    if (req.method === "POST") {
      const txt = await req.text();
      if (txt) body = JSON.parse(txt);
    }
  } catch {
    body = {};
  }

  // Authorize: either pg_cron with service-role bearer, OR an admin JWT scoped to the tenant being acted on
  const bearer = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  let authorized = bearer === serviceKey;

  if (!authorized && bearer) {
    try {
      const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: `Bearer ${bearer}` } } });
      const { data: userData } = await userClient.auth.getUser();
      if (userData?.user && body.tenant_id) {
        const { data: isAdmin } = await svc.rpc("is_admin", { _user_id: userData.user.id, _tenant_id: body.tenant_id });
        if (isAdmin) authorized = true;
      }
    } catch (_e) { /* ignored */ }
  }

  if (!authorized) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isManual = Boolean(body.member_id);
  const todayUtc = new Date();
  const todayMM = String(todayUtc.getUTCMonth() + 1).padStart(2, "0");
  const todayDD = String(todayUtc.getUTCDate()).padStart(2, "0");
  const todayDate = `${todayUtc.getUTCFullYear()}-${todayMM}-${todayDD}`;

  // 1. Pick tenants
  let tenantsQ = svc
    .from("birthday_message_settings")
    .select("*, tenants!inner(id, name, is_archived)")
    .eq("enabled", true);
  if (body.tenant_id) tenantsQ = tenantsQ.eq("tenant_id", body.tenant_id);
  const { data: tenants, error: tErr } = await tenantsQ;
  if (tErr) {
    console.error("send-birthday-messages tenant query failed:", tErr);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let processed = 0;
  let sent = 0;
  let failed = 0;
  const summary: Array<Record<string, unknown>> = [];

  for (const t of tenants || []) {
    if ((t as any).tenants?.is_archived) continue;

    // Skip in cron mode if it's not the configured local hour.
    // We use UTC for now; tenants in the project are UK so 8 BST/GMT ≈ same.
    if (!isManual) {
      const nowHour = todayUtc.getUTCHours();
      if (nowHour !== (t.send_hour_local ?? 8)) continue;
    }

    const channels: string[] = body.channels?.length
      ? body.channels.filter((c) => (t.channels || []).includes(c))
      : (t.channels || []);
    if (channels.length === 0) continue;

    const churchName = (t as any).tenants?.name || "Your Church";

    // Query members with birthday today
    let mQ = svc
      .from("members")
      .select("id, first_name, last_name, email, phone, user_id, date_of_birth, membership_status")
      .eq("tenant_id", t.tenant_id)
      .not("date_of_birth", "is", null);
    if (body.member_id) mQ = mQ.eq("id", body.member_id);

    const { data: members, error: mErr } = await mQ;
    if (mErr) {
      console.error("Members query failed", t.tenant_id, mErr.message);
      continue;
    }

    const recipients = isManual
      ? (members || [])
      : (members || []).filter((m: any) => {
          if (!m.date_of_birth) return false;
          const d = new Date(m.date_of_birth + "T00:00:00Z");
          const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
          const dd = String(d.getUTCDate()).padStart(2, "0");
          return mm === todayMM && dd === todayDD;
        });

    for (const member of recipients) {
      processed++;
      const ctx: Record<string, string> = {
        first_name: member.first_name || "Friend",
        last_name: member.last_name || "",
        church_name: churchName,
      };

      for (const channel of channels) {
        // Idempotency: insert log row first; on conflict skip.
        // Skip log insert for manual test sends so they aren't blocked by
        // the unique constraint and don't pollute real birthday history.
        if (!isManual) {
          const { error: logInsErr } = await svc
            .from("birthday_message_log")
            .insert({
              tenant_id: t.tenant_id,
              member_id: member.id,
              channel,
              sent_on: todayDate,
              status: "sent",
            });
          if (logInsErr) {
            if ((logInsErr as any).code === "23505") {
              // Already sent today
              continue;
            }
            console.error("Log insert failed", logInsErr.message);
            continue;
          }
        }


        let ok = false;
        let errMsg: string | null = null;

        try {
          if (channel === "in_app") {
            if (!member.user_id) {
              errMsg = "Member has no linked user account";
            } else {
              const msg = applyVars(t.in_app_template, ctx);
              const { error } = await svc.from("notifications").insert({
                user_id: member.user_id,
                tenant_id: t.tenant_id,
                title: "🎂 Happy Birthday!",
                message: msg,
                type: "general",
                reference_id: member.id,
                reference_type: "birthday",
              });
              if (error) errMsg = error.message; else ok = true;
            }
          } else if (channel === "email") {
            if (!member.email) {
              errMsg = "Member has no email address";
            } else {
              const res = await fetch(
                `${supabaseUrl}/functions/v1/send-transactional-email`,
                {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${serviceKey}`,
                  },
                  body: JSON.stringify({
                    templateName: "birthday-greeting",
                    recipientEmail: member.email,
                    tenant_id: t.tenant_id,
                    idempotencyKey: isManual
                      ? `birthday-test-${member.id}-${Date.now()}`
                      : `birthday-${member.id}-${todayDate}`,
                    templateData: {
                      firstName: member.first_name,
                      lastName: member.last_name,
                      churchName,
                      subject: t.email_subject,
                      body: t.email_body,
                    },
                  }),
                },
              );
              const j = await res.json().catch(() => ({}));
              if (!res.ok) errMsg = j.error || `Email send failed (${res.status})`;
              else ok = true;
            }
          } else if (channel === "sms" || channel === "whatsapp") {
            if (!member.phone) {
              errMsg = "Member has no phone number";
            } else {
              const tmpl = channel === "sms" ? t.sms_template : t.whatsapp_template;
              const text = applyVars(tmpl, ctx);
              const res = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${serviceKey}`,
                },
                body: JSON.stringify({
                  recipients: [{ phone: member.phone, member_id: member.id }],
                  message: text,
                  sms_type: "birthday",
                  reference_id: member.id,
                  channel,
                  tenant_id: t.tenant_id,
                }),
              });
              const j = await res.json().catch(() => ({}));
              if (!res.ok) errMsg = j.error || `${channel} send failed (${res.status})`;
              else ok = true;
            }
          }
        } catch (e) {
          errMsg = (e as Error).message;
        }

        if (ok) {
          sent++;
        } else {
          failed++;
          if (!isManual) {
            await svc
              .from("birthday_message_log")
              .update({ status: "failed", error: errMsg })
              .eq("tenant_id", t.tenant_id)
              .eq("member_id", member.id)
              .eq("channel", channel)
              .eq("sent_on", todayDate);
          }
          summary.push({
            tenant_id: t.tenant_id,
            member_id: member.id,
            channel,
            error: errMsg,
          });
        }
      }
    }
  }

  return new Response(
    JSON.stringify({ processed, sent, failed, errors: summary.slice(0, 20) }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
