// Shared builder for the Statement of Result PDF.
// Mirrors the on-screen layout of src/components/exams/StatementOfResult.jsx.
//
// Uses jsPDF (pure JS, works in Deno via npm: specifier).

import { jsPDF } from "npm:jspdf@2.5.1";

const LETTER_GRADE_BANDS_DEFAULT = [
  { letter: "A+", label: "Excellent", min: 90, max: 100 },
  { letter: "A", label: "Merit", min: 80, max: 89 },
  { letter: "B", label: "Very Good", min: 70, max: 79 },
  { letter: "C", label: "Good", min: 60, max: 69 },
  { letter: "D", label: "Average", min: 50, max: 59 },
  { letter: "E", label: "Pass", min: 40, max: 49 },
  { letter: "F", label: "Fail", min: 0, max: 39 },
];

function resolveLetterGradeBands(course: any) {
  const custom = course?.letter_grade_bands;
  if (Array.isArray(custom) && custom.length > 0) return custom;
  return LETTER_GRADE_BANDS_DEFAULT;
}

function getLetterGrade(pct: number, bands: any[]) {
  const source = Array.isArray(bands) && bands.length > 0 ? bands : LETTER_GRADE_BANDS_DEFAULT;
  const sorted = [...source].sort((a, b) => Number(b.min) - Number(a.min));
  const p = Math.max(0, Math.min(100, Number(pct) || 0));
  for (const b of sorted) {
    if (p >= Number(b.min)) return b;
  }
  return sorted[sorted.length - 1];
}

function getClassification(pct: number, cls: any[]) {
  const sorted = [...(cls || [])].sort(
    (a, b) => (b.min_percentage ?? 0) - (a.min_percentage ?? 0),
  );
  for (const c of sorted) {
    if (pct >= (c.min_percentage ?? 0)) return c.label ?? "";
  }
  return "Fail";
}

function deriveCourseCode(course: any) {
  if (course?.course_code) return String(course.course_code).toUpperCase();
  const m = String(course?.name || "").match(/\(([^)]+)\)/);
  if (m) return m[1].toUpperCase().replace(/[^A-Z0-9]/g, "");
  const initials = String(course?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
  return initials || "CRS";
}

function deriveTenantCode(tenant: any) {
  const slug = String(tenant?.slug || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (slug && slug.length <= 6) return slug;
  const initials = String(tenant?.name || "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 6);
  return initials || slug.slice(0, 6) || "ORG";
}

function formatSessionLabel(session: any) {
  const dateStr = session?.starts_at || session?.starts_on || session?.created_at;
  if (dateStr) {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return `${d.toLocaleString("en-GB", { month: "long" }).toUpperCase()} ${d.getFullYear()}`;
    }
  }
  if (session?.name) return String(session.name).toUpperCase();
  const now = new Date();
  return `${now.toLocaleString("en-GB", { month: "long" }).toUpperCase()} ${now.getFullYear()}`;
}

export async function fetchImageAsDataUrl(
  url: string | null | undefined,
): Promise<{ dataUrl: string; format: "PNG" | "JPEG" } | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    const buf = new Uint8Array(await res.arrayBuffer());
    // base64 encode
    let bin = "";
    for (let i = 0; i < buf.length; i++) bin += String.fromCharCode(buf[i]);
    const b64 = btoa(bin);
    const format: "PNG" | "JPEG" = ct.includes("jpeg") || ct.includes("jpg") ? "JPEG" : "PNG";
    const mime = format === "JPEG" ? "image/jpeg" : "image/png";
    return { dataUrl: `data:${mime};base64,${b64}`, format };
  } catch {
    return null;
  }
}

export interface BuildStatementPdfInput {
  member: { id: string; name: string };
  course: {
    id: string;
    name: string;
    course_code?: string | null;
    pass_mark_percentage?: number | null;
    grade_classifications?: any[] | null;
    letter_grade_bands?: any[] | null;
  };
  subjects: Array<{ id: string; name: string }>;
  memberSubjects: Record<string, { score: number; total_points: number } | undefined>;
  session: any | null;
  studentNumber: string;
  template: {
    church_name?: string | null;
    centre_name?: string | null;
    logo_url?: string | null;
    crest_image_url?: string | null;
    wofbi_logo_url?: string | null;
    dean_signature_url?: string | null;
    signatory_name?: string | null;
    signatory_title?: string | null;
  } | null;
  tenant: { name?: string | null; logo_url?: string | null; slug?: string | null };
  /** Pre-fetched/encoded images so bulk renders don't re-download per student. */
  images?: {
    logo?: { dataUrl: string; format: "PNG" | "JPEG" } | null;
    signature?: { dataUrl: string; format: "PNG" | "JPEG" } | null;
  } | null;
}

export function deriveStudentNumber(input: {
  storedStudentNumber?: string | null;
  tenant: { name?: string | null; slug?: string | null };
  course: any;
  session: any | null;
  seq: number;
}) {
  const stored = input.storedStudentNumber && String(input.storedStudentNumber).trim();
  if (stored) return stored;
  const tenantCode = deriveTenantCode(input.tenant);
  const courseCode = deriveCourseCode(input.course);
  const sessionLabel = formatSessionLabel(input.session).replace(/\s+/g, "/");
  const seqStr = String(100 + input.seq).padStart(3, "0");
  return `${tenantCode}/${courseCode}/${sessionLabel}/${seqStr}`;
}

export { formatSessionLabel, resolveLetterGradeBands, getLetterGrade, getClassification };

export async function buildStatementPdf(input: BuildStatementPdfInput): Promise<Uint8Array> {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  await renderStatementOnDoc(doc, input);
  const ab = doc.output("arraybuffer");
  return new Uint8Array(ab);
}

/**
 * Draws one Statement of Result onto the current page of `doc`.
 * The layout auto-scales so it always fits a single A4 page.
 */
export async function renderStatementOnDoc(doc: any, input: BuildStatementPdfInput) {
  const {
    member,
    course,
    subjects,
    memberSubjects,
    session,
    studentNumber,
    template,
    tenant,
  } = input;

  const letterBands = resolveLetterGradeBands(course);
  const classifications = (course.grade_classifications && course.grade_classifications.length > 0)
    ? course.grade_classifications
    : [
      { label: "Distinction", min_percentage: 75 },
      { label: "Merit", min_percentage: 65 },
      { label: "Pass", min_percentage: 50 },
    ];

  const rows = subjects.map((s) => {
    const sub = memberSubjects[s.id];
    const pct = sub && sub.total_points > 0 ? (sub.score / sub.total_points) * 100 : 0;
    const letter = sub ? getLetterGrade(pct, letterBands).letter : "—";
    return {
      name: s.name,
      score: sub?.score ?? 0,
      total: sub?.total_points ?? 0,
      pct,
      letter,
      taken: !!sub,
    };
  });

  const totalScore = rows.reduce((s, r) => s + r.score, 0);
  const totalPoints = rows.reduce((s, r) => s + r.total, 0);
  const overallPct = totalPoints > 0 ? (totalScore / totalPoints) * 100 : 0;
  const overallGrade = getClassification(overallPct, classifications);

  const sessionLabel = formatSessionLabel(session);
  const churchName = template?.church_name || tenant?.name || "";
  const centreName = template?.centre_name ||
    (tenant?.name && template?.church_name && template.church_name !== tenant.name ? tenant.name : "");
  const logoUrl = template?.wofbi_logo_url ||
    template?.crest_image_url ||
    template?.logo_url ||
    tenant?.logo_url ||
    "";
  const signatoryName = template?.signatory_name || "";
  const signatoryTitle = template?.signatory_title || "";
  const signatureUrl = template?.dean_signature_url || "";
  const isBibleSchool = /bible school|wofbi|bcc|bfc|lcc|ldc/i.test(course.name || "");

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginX = 20;
  const marginTop = 16;
  const marginBottom = 14;
  const contentWidth = pageWidth - marginX * 2;
  const available = pageHeight - marginTop - marginBottom;

  const preLogo = input.images?.logo;
  const preSig = input.images?.signature;
  const [logo, sig] = (preLogo !== undefined || preSig !== undefined)
    ? [preLogo ?? null, preSig ?? null]
    : await Promise.all([
      fetchImageAsDataUrl(logoUrl),
      fetchImageAsDataUrl(signatureUrl),
    ]);

  // ---- Measure -------------------------------------------------------------
  const colModuleW = contentWidth * 0.75;
  const colGradeW = contentWidth * 0.25;

  // Module titles may wrap onto (at most) two lines.
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const moduleLines = rows.map((r) => {
    const lines = doc.splitTextToSize((r.name || "").toUpperCase(), colModuleW - 8) as string[];
    return lines.slice(0, 2);
  });

  doc.setFontSize(11);
  const courseLine = `${(course.name || "").toUpperCase()} ${sessionLabel}`;
  const courseLines = doc.splitTextToSize(courseLine, contentWidth) as string[];

  const base = {
    logoH: logo ? 26 : 0,
    logoGap: logo ? 4 : 0,
    churchH: 8,
    centreH: centreName ? 6 : 0,
    titleH: 5,
    courseH: 5 * courseLines.length + 8,
    nameH: 8,
    tableGap: 2,
    headerH: 8,
    rowH: 6.5,
    footerH: 8,
    afterTable: 8,
    notesTitleH: 5,
    notesHeadH: 4,
    notesRowH: 4,
    afterNotes: 8,
    sigH: 15,
    sigNameH: 4,
    sigTitleH: 4,
  };

  const rowsHeight = moduleLines.reduce((sum, l) => sum + base.rowH * (l.length > 1 ? 1.7 : 1), 0);
  const needed = base.logoH + base.logoGap + base.churchH + base.centreH + base.titleH +
    base.courseH + base.nameH + base.tableGap + base.headerH + rowsHeight + base.footerH +
    base.afterTable + base.notesTitleH + base.notesHeadH + letterBands.length * base.notesRowH +
    base.afterNotes + base.sigH + base.sigNameH + base.sigTitleH;

  const scale = Math.max(0.55, Math.min(1, available / Math.max(needed, 1)));
  const fs = (pt: number, floor = 6.5) => Math.max(floor, pt * Math.max(scale, 0.72));
  const sp = (mm: number) => mm * scale;

  // ---- Draw ---------------------------------------------------------------
  if (isBibleSchool) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(120);
    doc.setTextColor(230, 230, 230);
    doc.text("WOFBI", pageWidth / 2, 170, { align: "center", angle: 35 } as any);
    doc.setTextColor(0, 0, 0);
  }

  let y = marginTop;

  if (logo) {
    try {
      const props = doc.getImageProperties(logo.dataUrl);
      const maxW = 60;
      const maxH = sp(base.logoH);
      const ratio = props?.width && props?.height ? props.width / props.height : 1;
      let logoH = maxH;
      let logoW = logoH * ratio;
      if (logoW > maxW) {
        logoW = maxW;
        logoH = logoW / ratio;
      }
      doc.addImage(logo.dataUrl, logo.format, pageWidth / 2 - logoW / 2, y, logoW, logoH, "stmt-logo", "FAST");
      y += logoH + sp(base.logoGap);
    } catch {
      // ignore
    }
  }

  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  const churchSize = fs(22, 12);
  doc.setFontSize(churchSize);
  const churchLines = (doc.splitTextToSize((churchName || "").toUpperCase(), contentWidth) as string[])
    .slice(0, 2);
  y += churchSize * 0.35;
  churchLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2, y + i * (churchSize * 0.42), { align: "center" });
  });
  y += (churchLines.length - 1) * (churchSize * 0.42) + sp(base.churchH) * 0.5;

  if (centreName) {
    doc.setFontSize(fs(12, 8));
    doc.text(centreName.toUpperCase(), pageWidth / 2, y, { align: "center" });
    y += sp(base.centreH);
  }

  doc.setFontSize(fs(11, 8));
  doc.text("STATEMENT OF RESULT", pageWidth / 2, y, { align: "center" });
  y += sp(base.titleH);

  courseLines.forEach((line, i) => {
    doc.text(line, pageWidth / 2, y + i * sp(5), { align: "center" });
  });
  y += (courseLines.length - 1) * sp(5) + sp(8);

  // Name row
  doc.setFontSize(fs(10, 8));
  doc.setFont("helvetica", "bold");
  doc.text("NAME:", marginX, y);
  const nameLabelW = doc.getTextWidth("NAME: ");
  doc.setFont("times", "italic");
  doc.setFontSize(fs(14, 10));
  doc.setTextColor(107, 63, 160);
  const nameMaxW = contentWidth - nameLabelW - 45;
  const nameText = (doc.splitTextToSize(member.name, nameMaxW) as string[])[0] || member.name;
  doc.text(nameText, marginX + nameLabelW, y);
  doc.setTextColor(0, 0, 0);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs(9, 7));
  const stuNumWidth = doc.getTextWidth(studentNumber);
  doc.text(studentNumber, pageWidth - marginX, y, { align: "right" });
  doc.setLineWidth(0.3);
  doc.line(pageWidth - marginX - stuNumWidth, y + 1, pageWidth - marginX, y + 1);
  y += sp(6);

  // Modules table
  const tableStartY = y + sp(base.tableGap);
  const rowH = sp(base.rowH);
  const headerH = sp(base.headerH);
  const tableFs = fs(10, 7);

  doc.setFillColor(219, 229, 241);
  doc.rect(marginX, tableStartY, contentWidth, headerH, "F");
  doc.setDrawColor(183, 199, 217);
  doc.setLineWidth(0.2);
  doc.line(marginX, tableStartY + headerH, marginX + contentWidth, tableStartY + headerH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tableFs);
  doc.setTextColor(0, 0, 0);
  doc.text("Module Title", marginX + 3, tableStartY + headerH - headerH * 0.3);
  doc.text("Grades", marginX + contentWidth - 3, tableStartY + headerH - headerH * 0.3, {
    align: "right",
  });

  let rowY = tableStartY + headerH;
  doc.setFontSize(tableFs);
  rows.forEach((r, i) => {
    const lines = moduleLines[i];
    const thisRowH = rowH * (lines.length > 1 ? 1.7 : 1);
    doc.setFont("helvetica", "normal");
    lines.forEach((line, li) => {
      doc.text(line, marginX + 3, rowY + rowH - rowH * 0.3 + li * (rowH * 0.7));
    });
    doc.setFont("helvetica", "bold");
    doc.text(r.taken ? r.letter : "—", marginX + contentWidth - 3, rowY + rowH - rowH * 0.3, {
      align: "right",
    });
    rowY += thisRowH;
  });

  doc.setFillColor(219, 229, 241);
  doc.rect(marginX, rowY, contentWidth, headerH, "F");
  doc.setLineWidth(0.2);
  doc.line(marginX, rowY, marginX + contentWidth, rowY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(tableFs);
  doc.text(
    `Overall Result:  ${overallGrade}`,
    marginX + contentWidth - 3,
    rowY + headerH - headerH * 0.3,
    { align: "right" },
  );
  rowY += headerH + sp(base.afterTable);

  // Explanatory Notes
  doc.setFont("helvetica", "bolditalic");
  doc.setFontSize(fs(10, 7.5));
  doc.text("Explanatory Notes", marginX, rowY);
  const notesTitleW = doc.getTextWidth("Explanatory Notes");
  doc.setLineWidth(0.2);
  doc.line(marginX, rowY + 0.8, marginX + notesTitleW, rowY + 0.8);
  rowY += sp(base.notesTitleH);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(fs(9, 6.5));
  doc.text("Result", marginX, rowY);
  doc.text("Grades", marginX + 60, rowY);
  rowY += sp(base.notesRowH);
  doc.setFont("helvetica", "normal");
  for (const b of letterBands) {
    doc.text(String(b.label ?? ""), marginX, rowY);
    doc.text(`${b.letter}   ${b.min}-${b.max}`, marginX + 60, rowY);
    rowY += sp(base.notesRowH);
  }

  // Signature block — anchored near the bottom, but never overlapping the notes
  const sigBlockH = sp(base.sigH) + sp(base.sigNameH) + sp(base.sigTitleH);
  let sigTop = Math.max(rowY + sp(6), pageHeight - marginBottom - sigBlockH);
  if (sigTop + sigBlockH > pageHeight - marginBottom) {
    sigTop = pageHeight - marginBottom - sigBlockH;
  }

  let sigBaseline = sigTop + sp(base.sigH);
  if (sig) {
    try {
      const sp2 = doc.getImageProperties(sig.dataUrl);
      const sRatio = sp2?.width && sp2?.height ? sp2.width / sp2.height : 40 / 14;
      let sH = sp(14);
      let sW = sH * sRatio;
      if (sW > 50) {
        sW = 50;
        sH = sW / sRatio;
      }
      doc.addImage(sig.dataUrl, sig.format, marginX, sigBaseline - sH, sW, sH, "stmt-sig", "FAST");
    } catch {
      // ignore
    }
  } else {
    doc.setLineWidth(0.3);
    doc.line(marginX, sigBaseline, marginX + 50, sigBaseline);
  }
  sigBaseline += sp(4);
  if (signatoryName) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(fs(9, 7));
    doc.text(signatoryName, marginX, sigBaseline);
    sigBaseline += sp(4);
  }
  if (signatoryTitle) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(fs(9, 7));
    doc.text(signatoryTitle, marginX, sigBaseline);
  }
}

