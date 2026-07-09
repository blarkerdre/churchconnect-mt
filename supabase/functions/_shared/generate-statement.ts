import { buildStatementPdf, deriveStudentNumber } from "./statement-pdf.ts";

const BUCKET = "exam-statements";
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24 * 30; // 30 days

export async function generateAndUploadStatement(
  admin: any,
  tenantId: string,
  courseId: string,
  memberId: string,
) {
  const { data: member } = await admin
    .from("members")
    .select("id, first_name, last_name, email, tenant_id")
    .eq("id", memberId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!member) throw new Error("Member not found");

  const { data: course } = await admin
    .from("exam_titles")
    .select("id, name, course_code, pass_mark_percentage, grade_classifications, letter_grade_bands, tenant_id")
    .eq("id", courseId)
    .eq("tenant_id", tenantId)
    .maybeSingle();
  if (!course) throw new Error("Course not found");

  const { data: subjects } = await admin
    .from("exam_subjects")
    .select("id, name, sort_order")
    .eq("course_id", courseId)
    .eq("is_active", true)
    .order("sort_order");

  const subjectIds = (subjects || []).map((s: any) => s.id);

  const memberSubjects: Record<string, { score: number; total_points: number }> = {};
  if (subjectIds.length > 0) {
    const { data: attempts } = await admin
      .from("exam_attempts")
      .select("subject_id, score, total_points")
      .eq("member_id", memberId)
      .in("subject_id", subjectIds);
    (attempts || []).forEach((a: any) => {
      if (!a.subject_id) return;
      const cur = memberSubjects[a.subject_id];
      const pct = a.total_points > 0 ? a.score / a.total_points : 0;
      const curPct = cur && cur.total_points > 0 ? cur.score / cur.total_points : -1;
      if (!cur || pct > curPct) {
        memberSubjects[a.subject_id] = { score: a.score || 0, total_points: a.total_points || 0 };
      }
    });
  }

  const { data: reg } = await admin
    .from("course_registrations")
    .select("id, student_number, session_id, registered_at")
    .eq("tenant_id", tenantId)
    .eq("course_id", courseId)
    .eq("member_id", memberId)
    .maybeSingle();

  let session: any = null;
  if (reg?.session_id) {
    const { data } = await admin
      .from("exam_sessions")
      .select("id, name, starts_at, starts_on, ended_at, created_at")
      .eq("id", reg.session_id)
      .maybeSingle();
    session = data;
  }
  if (!session && subjectIds.length > 0) {
    const { data: atts } = await admin
      .from("exam_attempts")
      .select("session_id, submitted_at")
      .eq("member_id", memberId)
      .in("subject_id", subjectIds)
      .not("session_id", "is", null)
      .order("submitted_at", { ascending: false, nullsFirst: false });
    const sid = atts?.find((a: any) => a.session_id)?.session_id;
    if (sid) {
      const { data } = await admin
        .from("exam_sessions")
        .select("id, name, starts_at, starts_on, ended_at, created_at")
        .eq("id", sid)
        .maybeSingle();
      session = data;
    }
  }

  let seq = 1;
  if (reg?.id) {
    let q = admin
      .from("course_registrations")
      .select("id, registered_at")
      .eq("tenant_id", tenantId)
      .eq("course_id", courseId)
      .order("registered_at", { ascending: true });
    if (session?.id) q = q.eq("session_id", session.id);
    const { data: allRegs } = await q;
    const idx = (allRegs || []).findIndex((r: any) => r.id === reg.id);
    if (idx >= 0) seq = idx + 1;
  }

  const { data: template } = await admin
    .from("certificate_templates")
    .select("signatory_name, signatory_title, dean_signature_url, logo_url, crest_image_url, church_name, wofbi_logo_url, centre_name")
    .eq("tenant_id", tenantId)
    .eq("training_type", course.name)
    .maybeSingle();

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, logo_url")
    .eq("id", tenantId)
    .maybeSingle();

  const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Student";

  const studentNumber = deriveStudentNumber({
    storedStudentNumber: reg?.student_number,
    tenant: { name: tenant?.name, slug: tenant?.slug },
    course,
    session,
    seq,
  });

  const pdfBytes = await buildStatementPdf({
    member: { id: member.id, name: memberName },
    course,
    subjects: subjects || [],
    memberSubjects,
    session,
    studentNumber,
    template,
    tenant: tenant || {},
  });

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const stamp =
    `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const path = `${tenantId}/${courseId}/${memberId}/${stamp}-statement.pdf`;

  const { error: uploadErr } = await admin.storage
    .from(BUCKET)
    .upload(path, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });
  if (uploadErr) throw new Error(`Upload failed: ${uploadErr.message}`);

  const { data: signed, error: signErr } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_URL_EXPIRES_IN);
  if (signErr || !signed?.signedUrl) throw new Error(`Signed URL failed: ${signErr?.message}`);

  const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRES_IN * 1000).toISOString();

  return {
    path,
    signed_url: signed.signedUrl,
    expires_at: expiresAt,
    member_name: memberName,
    member_email: member.email as string | null,
    course_name: course.name as string,
    student_number: studentNumber,
    session_label_source: session,
  };
}
