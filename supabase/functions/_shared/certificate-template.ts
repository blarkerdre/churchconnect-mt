// Tolerant certificate_templates lookup for Bible School courses.
// Mirrors src/lib/certificate-template-lookup.js so server-generated documents
// find the same template (and logo) the UI shows.

const DEFAULT_COLUMNS =
  "signatory_name, signatory_title, dean_signature_url, logo_url, crest_image_url, church_name, wofbi_logo_url, centre_name, training_type";

function norm(s: unknown) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function codeFromLabel(label: unknown) {
  const m = String(label || "").match(/\(([^)]+)\)\s*$/);
  return (m ? m[1] : "").trim().toUpperCase();
}

export async function fetchCourseTemplate(
  admin: any,
  tenantId: string,
  course: { name?: string | null; course_code?: string | null },
  columns = DEFAULT_COLUMNS,
) {
  if (!tenantId || !course?.name) return null;
  const { data: rows } = await admin
    .from("certificate_templates")
    .select(columns)
    .eq("tenant_id", tenantId);
  if (!rows?.length) return null;

  const name = course.name;
  const exact = rows.find((r: any) => r.training_type === name);
  if (exact) return exact;

  const loose = rows.find((r: any) => norm(r.training_type) === norm(name));
  if (loose) return loose;

  const code = String(course.course_code || codeFromLabel(name) || "").trim().toUpperCase();
  if (code) {
    const byCode = rows.find((r: any) => codeFromLabel(r.training_type) === code);
    if (byCode) return byCode;
    const byWord = rows.find((r: any) =>
      norm(r.training_type).split(" ").includes(code.toLowerCase())
    );
    if (byWord) return byWord;
  }
  return null;
}

const PRIVATE_BUCKETS = ["church-documents"];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Only allow storage paths that belong to this church: they must start with
 * the church's own folder (or have no church folder, in which case it is added).
 * Paths for another church, or with "..", are refused.
 */
export function tenantScopedPath(raw: string, tenantId: string): string | null {
  const p = String(raw || "").trim().replace(/^\/+/, "");
  if (!p || !tenantId || p.includes("..") || p.includes("\\") || /^[a-z]+:\/\//i.test(p)) return null;
  if (p.startsWith(`${tenantId}/`)) return p;
  const first = p.split("/")[0];
  if (UUID_RE.test(first)) return null;
  return `${tenantId}/${p}`;
}

/**
 * Turn a stale public URL for a private bucket into a working signed URL.
 * Private files are only signed when they sit in this church's own folder.
 */
export async function signIfPrivate(admin: any, url: string | null | undefined, tenantId: string): Promise<string> {
  if (!url || typeof url !== "string") return "";
  // Bare storage object path (e.g. uploaded signatures) in the private bucket.
  if (!/^(https?:|data:|blob:)/i.test(url)) {
    const safe = tenantScopedPath(url, tenantId);
    if (!safe) return "";
    try {
      const { data } = await admin.storage.from("church-documents").createSignedUrl(safe, 60 * 60);
      if (data?.signedUrl) return data.signedUrl;
    } catch {
      // fall through
    }
    return "";
  }
  for (const bucket of PRIVATE_BUCKETS) {
    const fragment = `/object/public/${bucket}/`;
    const idx = url.indexOf(fragment);
    if (idx === -1) continue;
    let path = "";
    try {
      path = decodeURIComponent(url.slice(idx + fragment.length).split("?")[0]);
    } catch {
      return "";
    }
    const safe = tenantScopedPath(path, tenantId);
    if (!safe || !safe.startsWith(`${tenantId}/`) || safe !== path.replace(/^\/+/, "")) return "";
    try {
      const { data } = await admin.storage.from(bucket).createSignedUrl(safe, 60 * 60);
      if (data?.signedUrl) return data.signedUrl;
    } catch {
      // fall through
    }
    return "";
  }
  return url;
}

/** Replace private-bucket image URLs on a template with signed URLs (this church's files only). */
export async function resolveTemplateImages(admin: any, template: any, tenantId: string) {
  if (!template) return template;
  const [logo_url, crest_image_url, wofbi_logo_url, dean_signature_url] = await Promise.all([
    signIfPrivate(admin, template.logo_url, tenantId),
    signIfPrivate(admin, template.crest_image_url, tenantId),
    signIfPrivate(admin, template.wofbi_logo_url, tenantId),
    signIfPrivate(admin, template.dean_signature_url, tenantId),
  ]);
  return { ...template, logo_url, crest_image_url, wofbi_logo_url, dean_signature_url };
}
