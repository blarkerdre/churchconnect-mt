import { supabase } from "@/integrations/supabase/client";

const DEFAULT_COLUMNS =
  "signatory_name, signatory_title, dean_signature_url, logo_url, crest_image_url, church_name, wofbi_logo_url, centre_name, training_type";

function norm(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** "Basic Certificate Course (BCC)" -> "BCC" */
function codeFromLabel(label) {
  const m = String(label || "").match(/\(([^)]+)\)\s*$/);
  return (m ? m[1] : "").trim().toUpperCase();
}

/**
 * Resolve the certificate template for a Bible School course, tolerating
 * naming drift between exam_titles.name and certificate_templates.training_type.
 * Order: exact match -> case/punctuation-insensitive -> course code match.
 * Always tenant-scoped.
 */
export async function fetchCourseTemplate({ tenantId, course, columns = DEFAULT_COLUMNS }) {
  if (!tenantId || !course?.name) return null;

  const { data: rows, error } = await supabase
    .from("certificate_templates")
    .select(columns)
    .eq("tenant_id", tenantId);
  if (error || !rows?.length) return null;

  const name = course.name;
  const exact = rows.find((r) => r.training_type === name);
  if (exact) return exact;

  const loose = rows.find((r) => norm(r.training_type) === norm(name));
  if (loose) return loose;

  const code = String(course.course_code || codeFromLabel(name) || "").trim().toUpperCase();
  if (code) {
    const byCode = rows.find((r) => codeFromLabel(r.training_type) === code);
    if (byCode) return byCode;
    const byWord = rows.find((r) =>
      norm(r.training_type).split(" ").includes(code.toLowerCase()),
    );
    if (byWord) return byWord;
  }

  return null;
}

/** Preferred logo for a Bible School course template, with tenant fallback. */
export function templateLogoUrl(template, tenant) {
  return (
    template?.wofbi_logo_url ||
    template?.crest_image_url ||
    template?.logo_url ||
    tenant?.logo_url ||
    ""
  );
}
