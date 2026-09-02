import { createClient } from "npm:@supabase/supabase-js@2";
import { generateAndUploadStatement } from "../_shared/generate-statement.ts";
import { formatSessionLabel } from "../_shared/statement-pdf.ts";
import { sendRawManagedEmail } from "../_shared/managed-email.ts";

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

function getClassification(pct: number, cls: any[]) {
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
  if (!member.email) return { ok: false, error: "No email on file" };

  // Best attempts to compute overall for the email summary
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
  for (const s of subjects) {
    const b = best[s.id];
    totalScore += b?.score ?? 0;
    totalPoints += b?.total_points ?? 0;
  }
  const overallPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const passMark = course.pass_mark_percentage ?? 50;
  const passed = overallPct >= passMark;
  const overallClassification = getClassification(overallPct, course.grade_classifications || []);

  // Generate the PDF (same layout as the on-screen Statement of Result)
  let pdfResult: Awaited<ReturnType<typeof generateAndUploadStatement>>;
  try {
    pdfResult = await generateAndUploadStatement(supabase, tenant.id, course.id, memberId);
  } catch (e) {
    return { ok: false, error: `PDF generation failed: ${(e as Error).message}` };
  }

  const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Student";
  const senderName = tenant.settings?.email_sender_name || tenant.name || "mychurchconnect";
  const tenantSiteUrl = tenant.slug ? `https://${ROOT_DOMAIN}/t/${tenant.slug}` : `https://${ROOT_DOMAIN}`;
  const statusColor = passed ? "#38a169" : "#e53e3e";
  const statusText = passed ? "PASSED" : "NOT YET PASSED";
  const sessionLabel = formatSessionLabel(pdfResult.session_label_source);

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:640px;margin:0 auto;padding:20px 0 48px;">
  <div style="padding:24px 32px;background:#1a2d4d;border-radius:8px 8px 0 0;text-align:center;">
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0;">Statement of Result</p>
    <p style="color:#c9a961;font-size:14px;margin:6px 0 0;">${escHtml(course.name)} — ${escHtml(sessionLabel)}</p>
  </div>
  <div style="padding:28px 32px;background:#f8f9fa;">
    <h1 style="color:#1a2d4d;font-size:20px;font-weight:700;margin:0 0 8px;">${escHtml(memberName)}</h1>
    <p style="color:#4a5568;font-size:14px;margin:0 0 20px;">${escHtml(tenant.name)}</p>

    <table style="width:100%;border-collapse:collapse;margin:0 0 18px;font-size:14px;color:#1a2d4d;">
      <tr>
        <td style="padding:6px 0;color:#4a5568;">Student Number</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;">${escHtml(pdfResult.student_number)}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#4a5568;">Overall Result</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;">${escHtml(overallClassification || "—")}</td>
      </tr>
      <tr>
        <td style="padding:6px 0;color:#4a5568;">Status</td>
        <td style="padding:6px 0;text-align:right;font-weight:700;color:${statusColor};">${statusText}</td>
      </tr>
    </table>

    <p style="margin:0 0 18px;color:#4a5568;font-size:14px;line-height:1.55;">
      Your official Statement of Result is attached as a PDF. Click below to download it.
    </p>

    <div style="text-align:center;margin:20px 0 8px;">
      <a href="${escHtml(pdfResult.signed_url)}"
         style="background:#1a2d4d;border-radius:6px;color:#fff;display:inline-block;font-size:15px;font-weight:600;padding:14px 32px;text-decoration:none;">
        Download Statement of Result (PDF)
      </a>
    </div>
    <p style="text-align:center;margin:0 0 20px;color:#718096;font-size:12px;">
      Download link is valid for 30 days.
    </p>

    <div style="text-align:center;margin:12px 0 0;">
      <a href="${escHtml(tenantSiteUrl)}/auth" style="color:#1a2d4d;font-size:13px;text-decoration:underline;">View in your profile</a>
    </div>
  </div>
  <div style="padding:20px 32px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0;">${escHtml(tenant.name)} — Statement of Result</p>
  </div>
</div></body></html>`;

  const text = `Statement of Result — ${course.name} (${sessionLabel})

Student: ${memberName}
Student Number: ${pdfResult.student_number}
Overall Result: ${overallClassification || "—"}
Status: ${statusText}
Pass mark: ${passMark}%

Download your PDF (valid 30 days):
${pdfResult.signed_url}
`;

  const messageId = `statement-${crypto.randomUUID()}`;
  const recipient = member.email.trim().toLowerCase();

  try {
    await sendRawManagedEmail({
      supabase,
      to: recipient,
      subject: `Statement of Result: ${course.name}`,
      html,
      text,
      label: "statement-of-result",
      idempotencyKey: messageId,
      tenantId: tenant.id,
      messageId,
      fromName: String(senderName),
    });
  } catch (sendErr) {
    return { ok: false, error: (sendErr as Error).message };
  }

  return { ok: true, email: member.email };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

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
      .select("id, name, sort_order")
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
