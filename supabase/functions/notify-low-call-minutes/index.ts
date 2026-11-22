// Sends a church's "call minutes are low / used up" alerts to its owners and
// admins, using the wording and channels the church chose. Runs from the
// call status webhook (server only); signed-in owners/admins may send a test
// to themselves.
// deno-lint-ignore-file no-explicit-any
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { isAuthorizedScheduler } from "../_shared/scheduler-auth.ts";
import { cleanMessageText, messageContentProblem, tenantSuspended } from "../_shared/sender-guard.ts";
import { sendRawManagedEmail } from "../_shared/managed-email.ts";
import { notificationSentRecently, emailSentRecently, smsSentRecently } from "../_shared/notice-dedupe.ts";

const SITE = "https://app.churchmanagementsuite.org";
const UUID = /^[0-9a-f-]{36}$/i;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

export function defaultText(kind: string, church: string, left: number): string {
  return kind === "empty"
    ? `${church} has used all its phone call minutes. Calls can't be made until more minutes are added.`
    : `${church} has ${left} phone call minutes left. Top up soon so calls aren't interrupted.`;
}

export function buildText(template: string, kind: string, church: string, left: number): string {
  if (kind === "empty") return defaultText(kind, church, left);
  const t = cleanMessageText(template || "", true);
  if (!t || t.length > 300 || /[<>]/.test(t) || messageContentProblem(t, true, "texts")) return defaultText(kind, church, left);
  return t.replace(/\{minutes_left\}/g, String(left)).replace(/\{church_name\}/g, church);
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const svc = createClient(url, key);
  let body: any = {};
  try { body = await req.json(); } catch { /* empty */ }
  const tenantId = String(body?.tenant_id || "");
  if (!UUID.test(tenantId)) return json({ error: "tenant_id required" }, 400);

  const isServer = await isAuthorizedScheduler(req, svc);
  let testUser: string | null = null;
  if (!isServer) {
    const auth = req.headers.get("Authorization") || "";
    const { data: u } = await createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } }).auth.getUser();
    if (!u?.user) return json({ error: "Unauthorized" }, 401);
    const { data: m } = await svc.from("tenant_memberships").select("role").eq("tenant_id", tenantId).eq("user_id", u.user.id).maybeSingle();
    const { data: sa } = await svc.from("user_roles").select("id").eq("user_id", u.user.id).eq("role", "super_admin").maybeSingle();
    if (!sa && !["owner", "admin"].includes(m?.role)) return json({ error: "Forbidden" }, 403);
    testUser = u.user.id;
  }

  const { data: t } = await svc.from("tenants").select("name, slug, call_low_alert_settings, call_minutes_limit_monthly, call_minutes_balance").eq("id", tenantId).maybeSingle();
  if (!t) return json({ error: "Not found" }, 404);
  if (!testUser && await tenantSuspended(svc, tenantId)) return json({ skipped: "suspended" });
  const s = (t.call_low_alert_settings || {}) as any;
  const channels: string[] = Array.isArray(s.channels) ? s.channels : [];
  const roles: string[] = Array.isArray(s.recipients) && s.recipients.length ? s.recipients : ["owner"];

  let alerts: any[];
  if (testUser) {
    const { data: used } = await svc.rpc("call_minutes_used", { _tenant_id: tenantId });
    const left = Math.max(0, Number(t.call_minutes_limit_monthly || 0) - Number(used || 0)) + Number(t.call_minutes_balance || 0);
    alerts = [{ id: crypto.randomUUID(), kind: "low", minutes_left: left, test: true }];
  } else {
    const { data } = await svc.from("call_minute_alerts").select("*").eq("tenant_id", tenantId).is("delivered_at", null).order("created_at").limit(5);
    alerts = data || [];
  }
  if (!alerts.length) return json({ sent: 0 });

  let userIds: string[];
  if (testUser) userIds = [testUser];
  else {
    const { data: ms } = await svc.from("tenant_memberships").select("user_id").eq("tenant_id", tenantId).in("role", roles);
    userIds = [...new Set((ms || []).map((m: any) => m.user_id))];
  }
  const { data: profs } = userIds.length ? await svc.from("profiles").select("id, email").in("id", userIds) : { data: [] };
  const { data: mems } = userIds.length ? await svc.from("members").select("id, user_id, phone").eq("tenant_id", tenantId).in("user_id", userIds) : { data: [] };
  const link = `${SITE}/t/${t.slug}/settings`;
  let sent = 0;

  for (const a of alerts) {
    const text = buildText(s.template || "", a.kind, t.name, a.minutes_left);
    const title = a.kind === "empty" ? "Call minutes used up" : "Call minutes running low";
    const ref = a.id;
    for (const uid of userIds) {
      if (channels.includes("in_app") && !(await notificationSentRecently(svc, uid, "call_minutes", ref))) {
        const { error } = await svc.from("notifications").insert({ tenant_id: tenantId, user_id: uid, title, message: text, type: "general", reference_type: "call_minutes", reference_id: ref });
        if (!error) sent++;
      }
      const email = (profs || []).find((p: any) => p.id === uid)?.email;
      const prefix = `call-minutes-${ref}-${uid}`;
      if (channels.includes("email") && email && !(await emailSentRecently(svc, prefix))) {
        try {
          await sendRawManagedEmail({ supabase: svc as any, to: email, subject: `${t.name}: ${title}`, label: "call_minutes_alert", tenantId, messageId: prefix, idempotencyKey: prefix,
            html: `<p>${esc(text)}</p><p><a href="${link}">Open Billing to top up</a></p>`, text: `${text}\n\nTop up: ${link}` });
          sent++;
        } catch (e) { console.error("email failed", (e as Error).message); }
      }
      const mem = (mems || []).find((m: any) => m.user_id === uid);
      if (channels.includes("sms") && mem?.phone && !(await smsSentRecently(svc, "call_minutes_alert", ref, mem.phone))) {
        const r = await fetch(`${url}/functions/v1/send-sms`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
          body: JSON.stringify({ recipients: [{ phone: mem.phone, member_id: mem.id }], message: `${text} ${link}`, sms_type: "call_minutes_alert", reference_id: ref, channel: "sms", tenant_id: tenantId }) });
        if (r.ok) sent++; else console.error("sms failed", r.status);
      }
    }
    if (!a.test) await svc.from("call_minute_alerts").update({ delivered_at: new Date().toISOString() }).eq("id", a.id);
  }
  return json({ sent });
});
