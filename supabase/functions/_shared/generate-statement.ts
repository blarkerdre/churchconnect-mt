import {
  buildStatementPdf,
  deriveStudentNumber,
  fetchImageAsDataUrl,
  renderStatementOnDoc,
} from "./statement-pdf.ts";
import { fetchCourseTemplate, resolveTemplateImages, signIfPrivate } from "./certificate-template.ts";

const BUCKET = "exam-statements";
const SIGNED_URL_EXPIRES_IN = 60 * 60 * 24 * 30; // 30 days

export { renderStatementOnDoc };

export interface StatementSharedContext {
  course: any;
  subjects: any[];
  subjectIds: string[];
  template: any;
  tenant: any;
  images: {
    logo: { dataUrl: string; format: "PNG" | "JPEG" } | null;
    signature: { dataUrl: string; format: "PNG" | "JPEG" } | null;
  };
}

/**
 * Loads everything that is identical for every student of a course exactly once
 * (course, subjects, template, tenant, encoded logo/signature images).
 */
export async function buildStatementSharedContext(
  admin: any,
  tenantId: string,
  courseId: string,
): Promise<StatementSharedContext> {
  const { data: course } = await admin
    .from("exam_titles")
    .select(
      "id, name, course_code, pass_mark_percentage, grade_classifications, letter_grade_bands, tenant_id",
    )
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

  const rawTemplate = await fetchCourseTemplate(admin, tenantId, course);
  const template = await resolveTemplateImages(admin, rawTemplate);

  const { data: tenantRow } = await admin
    .from("tenants")
    .select("id, name, slug, logo_url")
    .eq("id", tenantId)
    .maybeSingle();
  const tenantLogo = await signIfPrivate(admin, tenantRow?.logo_url);
  const tenant = { ...(tenantRow || {}), logo_url: tenantLogo };

  const logoUrl = template?.wofbi_logo_url || template?.crest_image_url || template?.logo_url ||
    tenant?.logo_url || "";
  const signatureUrl = template?.dean_signature_url || "";
  const [logo, signature] = await Promise.all([
    fetchImageAsDataUrl(logoUrl),
    fetchImageAsDataUrl(signatureUrl),
  ]);

  return {
    course,
    subjects: subjects || [],
    subjectIds: (subjects || []).map((s: any) => s.id),
    template,
    tenant,
    images: { logo, signature },
  };
}

/**
 * Builds statement inputs for many students using batched queries and a single
 * shared context, so a bulk request stays within the edge function CPU budget.
 */
export async function collectStatementInputsBulk(
  admin: any,
  tenantId: string,
  courseId: string,
  memberIds: string[],
  shared?: StatementSharedContext,
) {
  const ctx = shared || await buildStatementSharedContext(admin, tenantId, courseId);

  const { data: members } = await admin
    .from("members")
    .select("id, first_name, last_name, email")
    .eq("tenant_id", tenantId)
    .in("id", memberIds);
  const memberById = new Map((members || []).map((m: any) => [m.id, m]));

  // All registrations for the course (needed for sequence numbers too).
  const { data: allRegs } = await admin
    .from("course_registrations")
    .select("id, member_id, student_number, session_id, registered_at")
    .eq("tenant_id", tenantId)
    .eq("course_id", courseId)
    .order("registered_at", { ascending: true });
  const regByMember = new Map((allRegs || []).map((r: any) => [r.member_id, r]));

  // Attempts for all requested members in one query.
  const attemptsByMember = new Map<string, Record<string, { score: number; total_points: number }>>();
  const sessionIdByMember = new Map<string, string>();
  if (ctx.subjectIds.length > 0) {
    const { data: attempts } = await admin
      .from("exam_attempts")
      .select("member_id, subject_id, score, total_points, session_id, submitted_at")
      .in("member_id", memberIds)
      .in("subject_id", ctx.subjectIds);
    (attempts || []).forEach((a: any) => {
      if (!a.member_id || !a.subject_id) return;
      const bucket = attemptsByMember.get(a.member_id) || {};
      const cur = bucket[a.subject_id];
      const pct = a.total_points > 0 ? a.score / a.total_points : 0;
      const curPct = cur && cur.total_points > 0 ? cur.score / cur.total_points : -1;
      if (!cur || pct > curPct) {
        bucket[a.subject_id] = { score: a.score || 0, total_points: a.total_points || 0 };
      }
      attemptsByMember.set(a.member_id, bucket);
      if (a.session_id && !sessionIdByMember.has(a.member_id)) {
        sessionIdByMember.set(a.member_id, a.session_id);
      }
    });
  }

  const sessionIds = new Set<string>();
  for (const mid of memberIds) {
    const sid = regByMember.get(mid)?.session_id || sessionIdByMember.get(mid);
    if (sid) sessionIds.add(sid);
  }
  const sessionById = new Map<string, any>();
  if (sessionIds.size > 0) {
    const { data: sessions } = await admin
      .from("exam_sessions")
      .select("id, name, starts_at, starts_on, ended_at, created_at")
      .in("id", Array.from(sessionIds));
    (sessions || []).forEach((s: any) => sessionById.set(s.id, s));
  }

  const results: Array<{ memberId: string; memberName: string; statementInput: any } | null> = [];
  const failed: Array<{ member_id: string; error: string }> = [];

  for (const mid of memberIds) {
    const member = memberById.get(mid);
    if (!member) {
      failed.push({ member_id: mid, error: "Member not found" });
      continue;
    }
    const reg = regByMember.get(mid);
    const sid = reg?.session_id || sessionIdByMember.get(mid);
    const session = sid ? sessionById.get(sid) || null : null;

    let seq = 1;
    if (reg?.id) {
      const scoped = (allRegs || []).filter((r: any) =>
        session?.id ? r.session_id === session.id : true
      );
      const idx = scoped.findIndex((r: any) => r.id === reg.id);
      if (idx >= 0) seq = idx + 1;
    }

    const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Student";
    const studentNumber = deriveStudentNumber({
      storedStudentNumber: reg?.student_number,
      tenant: { name: ctx.tenant?.name, slug: ctx.tenant?.slug },
      course: ctx.course,
      session,
      seq,
    });

    results.push({
      memberId: mid,
      memberName,
      statementInput: {
        member: { id: mid, name: memberName },
        course: ctx.course,
        subjects: ctx.subjects,
        memberSubjects: attemptsByMember.get(mid) || {},
        session,
        studentNumber,
        template: ctx.template,
        tenant: ctx.tenant,
        images: ctx.images,
      },
    });
  }

  return { items: results.filter(Boolean) as any[], failed };
}


/**
 * Gathers everything needed to render one member's Statement of Result.
 */
export async function collectStatementInput(
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

  const rawTemplate = await fetchCourseTemplate(admin, tenantId, course);
  const template = await resolveTemplateImages(admin, rawTemplate);

  const { data: tenant } = await admin
    .from("tenants")
    .select("id, name, slug, logo_url")
    .eq("id", tenantId)
    .maybeSingle();
  const tenantLogo = await signIfPrivate(admin, tenant?.logo_url);

  const memberName = `${member.first_name || ""} ${member.last_name || ""}`.trim() || "Student";

  const studentNumber = deriveStudentNumber({
    storedStudentNumber: reg?.student_number,
    tenant: { name: tenant?.name, slug: tenant?.slug },
    course,
    session,
    seq,
  });

  return {
    statementInput: {
      member: { id: member.id, name: memberName },
      course,
      subjects: subjects || [],
      memberSubjects,
      session,
      studentNumber,
      template,
      tenant: { ...(tenant || {}), logo_url: tenantLogo },
    },
    memberName,
    memberEmail: (member.email as string | null) ?? null,
    courseName: course.name as string,
    studentNumber,
    session,
  };
}

export async function generateAndUploadStatement(
  admin: any,
  tenantId: string,
  courseId: string,
  memberId: string,
) {
  const collected = await collectStatementInput(admin, tenantId, courseId, memberId);

  const pdfBytes = await buildStatementPdf(collected.statementInput);

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
    member_name: collected.memberName,
    member_email: collected.memberEmail,
    course_name: collected.courseName,
    student_number: collected.studentNumber,
    session_label_source: collected.session,
  };
}

