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

    // Get pass threshold
    let passThreshold = 50;
    if (subject_id) {
      const { data: subj } = await adminClient
        .from("exam_subjects")
        .select("pass_mark_percentage")
        .eq("id", subject_id)
        .maybeSingle();
      if (subj) passThreshold = subj.pass_mark_percentage;
    } else {
      const { data: course } = await adminClient
        .from("exam_titles")
        .select("pass_mark_percentage")
        .eq("name", training_type)
        .maybeSingle();
      if (course) passThreshold = course.pass_mark_percentage;
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
      await checkCourseCompletion(adminClient, member_id, training_type, member.tenant_id);
    } else if (passed) {
      await issueCertificate(supabaseUrl, serviceKey, member_id, training_type, attempt.id, member.tenant_id, adminClient);
    }

    // Send result statement email
    await sendResultEmail(adminClient, member, {
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

async function checkCourseCompletion(adminClient: any, memberId: string, courseName: string, tenantId: string) {
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
          body: JSON.stringify({ member_id: memberId, training_type: courseName, tenant_id: tenantId }),
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
  adminClient: any
) {
  try {
    const resp = await fetch(`${supabaseUrl}/functions/v1/issue-certificate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
      },
      body: JSON.stringify({ member_id: memberId, training_type: trainingType, tenant_id: tenantId }),
    });
    const certData = await resp.json();
    if (certData?.success) {
      await adminClient.from("exam_attempts").update({ certificate_issued: true }).eq("id", attemptId);
    }
  } catch (e) {
    console.error("Certificate generation failed:", e);
  }
}
