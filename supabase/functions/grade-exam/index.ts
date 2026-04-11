import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify the caller's JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await anonClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { member_id, subject_id, training_type, answers, tenant_id } = await req.json();

    if (!member_id || !training_type || !answers || typeof answers !== "object") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    // Verify the caller owns this member record
    const { data: member } = await adminClient
      .from("members")
      .select("id, user_id, tenant_id, email, first_name, last_name")
      .eq("id", member_id)
      .single();

    if (!member || member.user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Not authorized for this member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify tenant access
    const { data: tenantAccess } = await adminClient
      .from("tenant_memberships")
      .select("id")
      .eq("user_id", user.id)
      .eq("tenant_id", member.tenant_id)
      .maybeSingle();

    if (!tenantAccess) {
      return new Response(JSON.stringify({ error: "No tenant access" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch questions with correct answers (server-side only)
    let questionsQuery = adminClient.from("exam_questions").select("*");
    if (subject_id) {
      questionsQuery = questionsQuery.eq("subject_id", subject_id);
    } else {
      questionsQuery = questionsQuery.eq("training_type", training_type);
    }
    const { data: questions, error: qErr } = await questionsQuery.order("sort_order").order("created_at");
    if (qErr) throw qErr;
    if (!questions || questions.length === 0) {
      return new Response(JSON.stringify({ error: "No questions found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get pass threshold and email flags
    let passThreshold = 50;
    let sendResultEmail = true;
    let sendCertificateEmail = true;
    if (subject_id) {
      const { data: subj } = await adminClient
        .from("exam_subjects")
        .select("pass_mark_percentage, course_id")
        .eq("id", subject_id)
        .maybeSingle();
      if (subj) passThreshold = subj.pass_mark_percentage;
      // Fetch email flags from the course
      if (subj?.course_id) {
        const { data: courseFlags } = await adminClient
          .from("exam_titles")
          .select("send_result_email, send_certificate_email")
          .eq("id", subj.course_id)
          .maybeSingle();
        if (courseFlags) {
          sendResultEmail = courseFlags.send_result_email !== false;
          sendCertificateEmail = courseFlags.send_certificate_email !== false;
        }
      }
    } else {
      const { data: course } = await adminClient
        .from("exam_titles")
        .select("pass_mark_percentage, send_result_email, send_certificate_email")
        .eq("name", training_type)
        .maybeSingle();
      if (course) {
        passThreshold = course.pass_mark_percentage;
        sendResultEmail = course.send_result_email !== false;
        sendCertificateEmail = course.send_certificate_email !== false;
      }
    }

    // Grade
    const totalPoints = questions.reduce((s: number, q: any) => s + q.points, 0);
    let score = 0;
    const answerRows = questions.map((q: any) => {
      const qType = q.question_type || "multiple_choice";
      const selected = answers[q.id] || null;
      let isCorrect = false;
      if (qType === "multiple_choice") {
        isCorrect = selected === q.correct_answer;
      } else if (qType === "fill_in_gap") {
        isCorrect = selected && q.correct_answer &&
          selected.trim().toLowerCase() === q.correct_answer.trim().toLowerCase();
      } else if (qType === "drag_and_drop") {
        isCorrect = selected === q.correct_answer;
      }
      if (isCorrect) score += q.points;
      return {
        question_id: q.id,
        selected_answer: selected,
        is_correct: isCorrect,
      };
    });

    const percentage = totalPoints > 0 ? (score / totalPoints) * 100 : 0;
    const passed = percentage >= passThreshold;

    // Insert attempt
    const { data: attempt, error: attemptErr } = await adminClient
      .from("exam_attempts")
      .insert({
        member_id,
        training_type,
        subject_id: subject_id || null,
        completed_at: new Date().toISOString(),
        score,
        total_points: totalPoints,
        passed,
        tenant_id: member.tenant_id,
      })
      .select("id")
      .single();
    if (attemptErr) throw attemptErr;

    // Insert answers
    const answersPayload = answerRows.map((a: any) => ({
      ...a,
      attempt_id: attempt.id,
      tenant_id: member.tenant_id,
    }));
    const { error: ansErr } = await adminClient.from("exam_answers").insert(answersPayload);
    if (ansErr) throw ansErr;

    // Course completion check / certificate issuance
    if (subject_id) {
      await checkCourseCompletion(adminClient, member_id, training_type, member.tenant_id, sendCertificateEmail);
    } else if (passed) {
      await issueCertificate(supabaseUrl, serviceKey, member_id, training_type, attempt.id, member.tenant_id, adminClient, sendCertificateEmail);
    }

    // Send result statement email (if enabled)
    if (sendResultEmail) {
      await sendResultEmail_fn(adminClient, member, {
        subjectName: subject_id
          ? questions[0]?.subject_id ? (await adminClient.from("exam_subjects").select("name").eq("id", subject_id).single()).data?.name || training_type : training_type
          : training_type,
        score,
        totalPoints,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        passThreshold,
        tenantId: member.tenant_id,
      });
    }

    return new Response(
      JSON.stringify({
        score,
        totalPoints,
        percentage: Math.round(percentage * 100) / 100,
        passed,
        passThreshold,
        answerRows: answerRows.map((a: any) => ({
          question_id: a.question_id,
          selected_answer: a.selected_answer,
          is_correct: a.is_correct,
        })),
        // Include correct answers in the response for review
        correctAnswers: Object.fromEntries(questions.map((q: any) => [q.id, q.correct_answer])),
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("grade-exam error:", err);
    return new Response(JSON.stringify({ error: err.message || "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function checkCourseCompletion(adminClient: any, memberId: string, courseName: string, tenantId: string, sendCertificateEmail: boolean) {
  try {
    const { data: course } = await adminClient
      .from("exam_titles")
      .select("id, pass_mark_percentage")
      .eq("name", courseName)
      .maybeSingle();
    if (!course) return;

    const { data: subjects } = await adminClient
      .from("exam_subjects")
      .select("id")
      .eq("course_id", course.id)
      .eq("is_active", true);
    if (!subjects || subjects.length === 0) return;

    const subjectIds = subjects.map((s: any) => s.id);
    const { data: attempts } = await adminClient
      .from("exam_attempts")
      .select("subject_id, score, total_points")
      .eq("member_id", memberId)
      .in("subject_id", subjectIds);
    if (!attempts) return;

    const bestBySubject: Record<string, any> = {};
    attempts.forEach((a: any) => {
      if (!a.subject_id) return;
      const pct = a.total_points > 0 ? a.score / a.total_points : 0;
      if (!bestBySubject[a.subject_id] || pct > (bestBySubject[a.subject_id].score / bestBySubject[a.subject_id].total_points)) {
        bestBySubject[a.subject_id] = a;
      }
    });

    if (Object.keys(bestBySubject).length < subjectIds.length) return;

    const totalScore = Object.values(bestBySubject).reduce((s: number, a: any) => s + (a.score || 0), 0);
    const totalPoints = Object.values(bestBySubject).reduce((s: number, a: any) => s + (a.total_points || 0), 0);
    const aggregatePct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;

    if (aggregatePct >= course.pass_mark_percentage) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      try {
        await fetch(`${supabaseUrl}/functions/v1/issue-certificate`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({ member_id: memberId, training_type: courseName, tenant_id: tenantId, send_certificate_email: sendCertificateEmail }),
        });
      } catch (e) {
        console.error("Certificate issuance failed:", e);
      }
    }
  } catch (e) {
    console.error("Course completion check failed:", e);
  }
}

async function issueCertificate(
  supabaseUrl: string, serviceKey: string,
  memberId: string, trainingType: string, attemptId: string, tenantId: string,
  adminClient: any, sendCertificateEmail: boolean
) {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/issue-certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ member_id: memberId, training_type: trainingType, tenant_id: tenantId, send_certificate_email: sendCertificateEmail }),
  } catch (e) {
    console.error("Certificate generation failed:", e);
  }
}

async function sendResultEmail(
  adminClient: any,
  member: { email?: string; first_name?: string; last_name?: string; tenant_id?: string },
  result: { subjectName: string; score: number; totalPoints: number; percentage: number; passed: boolean; passThreshold: number; tenantId: string }
) {
  if (!member.email) return;

  const ROOT_DOMAIN = "app.churchmanagementsuite.org";
  const SENDER_DOMAIN = "notify.app.churchmanagementsuite.org";

  try {
    // Get tenant info for sender name
    let senderName = "mychurchconnect";
    let tenantSiteUrl = `https://${ROOT_DOMAIN}`;
    if (result.tenantId) {
      const { data: t } = await adminClient
        .from("tenants")
        .select("name, slug, settings")
        .eq("id", result.tenantId)
        .single();
      if (t) {
        const s = t.settings as Record<string, unknown> | null;
        senderName = (s?.email_sender_name as string) || t.name || senderName;
        if (t.slug) tenantSiteUrl = `https://${ROOT_DOMAIN}/t/${t.slug}`;
      }
    }

    const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Student";
    const statusColor = result.passed ? "#38a169" : "#e53e3e";
    const statusText = result.passed ? "PASSED" : "NOT YET PASSED";

    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:Georgia,'Times New Roman',serif;">
<div style="max-width:560px;margin:0 auto;padding:20px 0 48px;">
  <div style="padding:24px 32px;background:#1a2d4d;border-radius:8px 8px 0 0;text-align:center;">
    <p style="color:#fff;font-size:20px;font-weight:700;margin:0;">Exam Result Statement</p>
  </div>
  <div style="padding:32px;background:#f8f9fa;">
    <h1 style="color:#1a2d4d;font-size:22px;font-weight:700;margin:0 0 20px;">Hello ${memberName},</h1>
    <p style="color:#4a5568;font-size:15px;line-height:1.6;margin:0 0 16px;">
      Your exam for <strong>${result.subjectName}</strong> has been graded. Here are your results:
    </p>
    <table style="width:100%;border-collapse:collapse;margin:20px 0;">
      <tr><td style="padding:10px 16px;border:1px solid #e2e8f0;font-weight:600;background:#edf2f7;color:#1a2d4d;">Subject / Course</td><td style="padding:10px 16px;border:1px solid #e2e8f0;">${result.subjectName}</td></tr>
      <tr><td style="padding:10px 16px;border:1px solid #e2e8f0;font-weight:600;background:#edf2f7;color:#1a2d4d;">Score</td><td style="padding:10px 16px;border:1px solid #e2e8f0;">${result.score} / ${result.totalPoints}</td></tr>
      <tr><td style="padding:10px 16px;border:1px solid #e2e8f0;font-weight:600;background:#edf2f7;color:#1a2d4d;">Percentage</td><td style="padding:10px 16px;border:1px solid #e2e8f0;">${result.percentage}%</td></tr>
      <tr><td style="padding:10px 16px;border:1px solid #e2e8f0;font-weight:600;background:#edf2f7;color:#1a2d4d;">Pass Mark</td><td style="padding:10px 16px;border:1px solid #e2e8f0;">${result.passThreshold}%</td></tr>
      <tr><td style="padding:10px 16px;border:1px solid #e2e8f0;font-weight:600;background:#edf2f7;color:#1a2d4d;">Status</td><td style="padding:10px 16px;border:1px solid #e2e8f0;font-weight:700;color:${statusColor};">${statusText}</td></tr>
    </table>
    <div style="text-align:center;margin:24px 0;">
      <a href="${tenantSiteUrl}/auth" style="background:#1a2d4d;border-radius:6px;color:#fff;display:inline-block;font-size:15px;font-weight:600;padding:12px 32px;text-decoration:none;">View Full Results</a>
    </div>
    <p style="color:#4a5568;font-size:14px;line-height:1.6;margin:0;">
      ${result.passed ? "Congratulations on passing! Keep up the great work." : "Don't be discouraged — you can retake the exam when ready."}
    </p>
  </div>
  <hr style="border-color:#e2e8f0;margin:0;" />
  <div style="padding:24px 32px;text-align:center;">
    <p style="color:#a0aec0;font-size:12px;margin:0 0 4px;">Bible School — Exam Results</p>
  </div>
</div></body></html>`;

    const text = `Exam Result Statement\n\nHello ${memberName},\n\nYour exam for ${result.subjectName} has been graded.\n\nScore: ${result.score} / ${result.totalPoints} (${result.percentage}%)\nPass Mark: ${result.passThreshold}%\nStatus: ${statusText}\n\n${result.passed ? "Congratulations on passing!" : "You can retake the exam when ready."}\n\nView your results: ${tenantSiteUrl}/auth`;

    const messageId = crypto.randomUUID();

    await adminClient.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        to: member.email.trim().toLowerCase(),
        from: `"${senderName.replace(/"/g, "")}" <noreply@${ROOT_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: `Exam Result: ${result.subjectName} — ${statusText}`,
        html,
        text,
        purpose: "transactional",
        label: "exam-result",
        message_id: messageId,
        idempotency_key: messageId,
      },
    });

    console.log("Result email enqueued", { email: member.email, subjectName: result.subjectName });
  } catch (e) {
    console.error("Result email failed:", e);
  }
}
