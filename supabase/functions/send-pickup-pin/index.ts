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

    for (const adult of recipients || []) {
      const firstName = adult.first_name || "there";

      if (adult.email) {
        try {
          const { error: eErr } = await admin.functions.invoke("send-email-alert", {
            body: {
              subject: "Children's Church Pickup PIN",
              body:
                `Hi ${firstName},\n\n` +
                `${childNames} has been checked in to Children's Church.\n\n` +
                `Your pickup PIN is: ${pin}\n\n` +
                `Please keep this PIN private and show it at pickup. ` +
                `It will be required to collect your child.\n\nThank you.`,
              tenant_id,
              member_ids: [adult.id],
              audience_label: "Children's Church parent",
            },
          });
          if (eErr) throw eErr;
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
