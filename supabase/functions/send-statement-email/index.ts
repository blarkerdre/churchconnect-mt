import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const ROOT_DOMAIN = "app.churchmanagementsuite.org";
const SENDER_DOMAIN = "notify.app.churchmanagementsuite.org";

function escHtml(s: unknown) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getLetterGrade(pct: number, bands: any[]): string {
  if (!Array.isArray(bands)) return "";
  const sorted = [...bands].sort((a, b) => (b.min_percentage ?? 0) - (a.min_percentage ?? 0));
  for (const b of sorted) {
    if (pct >= (b.min_percentage ?? 0)) return b.letter ?? b.label ?? "";
  }
  return "";
}

function getClassification(pct: number, cls: any[]): string {
  if (!Array.isArray(cls)) return "";
  const sorted = [...cls].sort((a, b) => (b.min_percentage ?? 0) - (a.min_percentage ?? 0));
  for (const c of sorted) {
    if (pct >= (c.min_percentage ?? 0)) return c.label ?? "";
  }
  return "";
}

async function sendForMember(
  supabase: any,
  memberId: string,
  course: any,
  subjects: any[],
  tenant: { id: string; name: string; slug?: string | null; settings?: any },
): Promise<{ ok: boolean; error?: string; email?: string }> {
  const { data: member } = await supabase
    .from("members")
    .select("id, first_name, last_name, email")
    .eq("id", memberId)
    .eq("tenant_id", tenant.id)
    .maybeSingle();
  if (!member) return { ok: false, error: "Member not found" };
  if (!member.email) return { ok: false, error: "No email on file", email: undefined };

  const subjectIds = subjects.map((s) => s.id);
  const { data: attempts } = await supabase
    .from("exam_attempts")
    .select("subject_id, score, total_points")
    .eq("member_id", memberId)
    .in("subject_id", subjectIds);

  const best: Record<string, { score: number; total_points: number }> = {};
  (attempts || []).forEach((a: any) => {
    if (!a.subject_id) return;
    const cur = best[a.subject_id];
    const pct = a.total_points > 0 ? a.score / a.total_points : 0;
    const curPct = cur && cur.total_points > 0 ? cur.score / cur.total_points : -1;
    if (!cur || pct > curPct) {
      best[a.subject_id] = { score: a.score || 0, total_points: a.total_points || 0 };
    }
  });

  let totalScore = 0;
  let totalPoints = 0;
  const rows = subjects.map((s) => {
    const b = best[s.id];
    const score = b?.score ?? 0;
    const tp = b?.total_points ?? 0;
    const pct = tp > 0 ? (score / tp) * 100 : 0;
    const bands = Array.isArray(s.letter_grade_bands) && s.letter_grade_bands.length > 0
      ? s.letter_grade_bands
      : course.letter_grade_bands || [];
    const cls = Array.isArray(s.grade_classifications) && s.grade_classifications.length > 0
      ? s.grade_classifications
      : course.grade_classifications || [];
    return {
      name: s.name,
      score,
      total_points: tp,
      pct,
      letter: b ? getLetterGrade(pct, bands) : "—",
      classification: b ? getClassification(pct, cls) : "—",
      taken: !!b,
    };
  });

  rows.forEach((r) => {
    totalScore += r.score;
    totalPoints += r.total_points;
  });
  const overallPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const passMark = course.pass_mark_percentage ?? 50;
  const passed = overallPct >= passMark;
  const overallClassification = getClassification(overallPct, course.grade_classifications || []);

  const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Student";
  const senderName = tenant.settings?.email_sender_name || tenant.name || "mychurchconnect";
  const tenantSiteUrl = tenant.slug ? `https://${ROOT_DOMAIN}/t/${tenant.slug}` : `https://${ROOT_DOMAIN}`;
  const statusColor = passed ? "#38a169" : "#e53e3e";
  const statusText = passed ? "PASSED" : "NOT YET PASSED";

  const rowsHtml = rows
    .map(
      (r) => `<tr>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;">${escHtml(r.name)}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">${r.taken ? `${r.score} / ${r.total_points}` : "—"}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">${r.taken ? `${Math.round(r.pct)}%` : "—"}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">${escHtml(r.letter)}</td>
      <td style="padding:8px 12px;border:1px solid #e2e8f0;text-align:center;">${escHtml(r.classification)}</td>
    </tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:640px;margin:0 auto;padding:20px 0 48px;">
  <div style="padding:24px 32px;background:#1a2d4d;border-radius:8px 8px 0 0;text-align:center;">
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0;">Statement of Result</p>
    <p style="color:#c9a961;font-size:14px;margin:6px 0 0;">${escHtml(course.name)}</p>
  </div>
  <div style="padding:28px 32px;background:#f8f9fa;">
    <h1 style="color:#1a2d4d;font-size:20px;font-weight:700;margin:0 0 8px;">${escHtml(memberName)}</h1>
    <p style="color:#4a5568;font-size:14px;margin:0 0 20px;">${escHtml(tenant.name)}</p>
    <table style="width:100%;border-collapse:collapse;margin:0 0 20px;font-size:13px;">
      <thead>
        <tr style="background:#edf2f7;color:#1a2d4d;">
          <th style="padding:10px 12px;border:1px solid #e2e8f0;text-align:left;">Subject</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;">Score</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;">%</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;">Grade</th>
          <th style="padding:10px 12px;border:1px solid #e2e8f0;">Classification</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
      <tfoot>
        <tr style="background:#edf2f7;font-weight:700;color:#1a2d4d;">
          <td style="padding:10px 12px;border:1px solid #e2e8f0;">Overall</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;">${totalScore} / ${totalPoints}</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;">${Math.round(overallPct)}%</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;">—</td>
          <td style="padding:10px 12px;border:1px solid #e2e8f0;text-align:center;">${escHtml(overallClassification)}</td>
        </tr>
      </tfoot>
    </table>
    <p style="margin:0 0 16px;color:#4a5568;font-size:14px;">
      Pass mark: <strong>${passMark}%</strong> — Status:
      <strong style="color:${statusColor};">${statusText}</strong>
    </p>
    <div style="text-align:center;margin:24px 0 0;">
      <a href="${escHtml(tenantSiteUrl)}/auth" style="background:#1a2d4d;border-radius:6px;color:#fff;display:inline-block;font-size:14px;font-weight:600;padding:12px 28px;text-decoration:none;">View in your profile</a>
    </div>
  </div>
  <div style="padding:20px 32px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">Bible School — Statement of Result</p>
  </div>
</div></body></html>`;

  const text = `Statement of Result — ${course.name}\n\nStudent: ${memberName}\n\n` +
    rows.map((r) => `${r.name}: ${r.taken ? `${r.score}/${r.total_points} (${Math.round(r.pct)}%) ${r.letter}` : "—"}`).join("\n") +
    `\n\nOverall: ${totalScore}/${totalPoints} (${Math.round(overallPct)}%) — ${statusText}\nPass mark: ${passMark}%`;

  const messageId = `statement-${crypto.randomUUID()}`;

  await supabase.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      to: member.email.trim().toLowerCase(),
      from: `"${String(senderName).replace(/"/g, "")}" <noreply@${ROOT_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject: `Statement of Result: ${course.name}`,
      html,
      text,
      purpose: "transactional",
      label: "statement-of-result",
      message_id: messageId,
      idempotency_key: messageId,
      queued_at: new Date().toISOString(),
      tenant_id: tenant.id,
    },
  });

  await supabase.from("email_send_log").insert({
    message_id: messageId,
    template_name: "statement-of-result",
    recipient_email: member.email,
    status: "pending",
    tenant_id: tenant.id,
  });

  return { ok: true, email: member.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    // Auth: must be an admin in this tenant
    const authHeader = req.headers.get("Authorization") || "";
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { course_id, tenant_id } = body;
    let memberIds: string[] = [];
    if (Array.isArray(body.member_ids) && body.member_ids.length > 0) memberIds = body.member_ids;
    else if (body.member_id) memberIds = [body.member_id];

    if (!course_id || !tenant_id || memberIds.length === 0) {
      return new Response(
        JSON.stringify({ error: "course_id, tenant_id and at least one member_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const { data: isAdmin } = await admin.rpc("is_admin", { _user_id: userId, _tenant_id: tenant_id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: course, error: courseErr } = await admin
      .from("exam_titles")
      .select("id, name, course_code, pass_mark_percentage, grade_classifications, letter_grade_bands, tenant_id")
      .eq("id", course_id)
      .eq("tenant_id", tenant_id)
      .maybeSingle();
    if (courseErr || !course) {
      return new Response(JSON.stringify({ error: "Course not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: subjects } = await admin
      .from("exam_subjects")
      .select("id, name, pass_mark_percentage, grade_classifications, letter_grade_bands, sort_order")
      .eq("course_id", course_id)
      .eq("is_active", true)
      .order("sort_order");

    const { data: tenant } = await admin
      .from("tenants")
      .select("id, name, slug, settings")
      .eq("id", tenant_id)
      .maybeSingle();
    if (!tenant) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];
    for (const mid of memberIds) {
      try {
        const r = await sendForMember(admin, mid, course, subjects || [], tenant);
        results.push({ member_id: mid, ...r });
      } catch (e) {
        results.push({ member_id: mid, ok: false, error: (e as Error).message });
      }
    }

    const sent = results.filter((r) => r.ok).length;
    const failed = results.length - sent;

    return new Response(
      JSON.stringify({ success: true, sent, failed, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("send-statement-email error:", err);
    return new Response(JSON.stringify({ error: "An unexpected error occurred" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
