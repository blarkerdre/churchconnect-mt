// Real OOXML (.docx) generation for the Bible School course final report.
// Built with JSZip (already a dependency) so Word/Google Docs open it natively —
// the previous HTML-renamed-to-.doc file was rejected as "corrupt" by Word.
import JSZip from "jszip";
import { FINDING_FIELDS, QC_CHECKLIST_FIELDS } from "@/lib/wofbi-report-defaults";

const NAVY = "1E3A5F";

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
    // strip control chars that are illegal in XML
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "");
}

function runProps({ bold, underline, size, color, caps } = {}) {
  const p = [];
  if (bold) p.push("<w:b/>");
  if (underline) p.push('<w:u w:val="single"/>');
  if (color) p.push(`<w:color w:val="${color}"/>`);
  if (caps) p.push("<w:caps/>");
  if (size) p.push(`<w:sz w:val="${size}"/><w:szCs w:val="${size}"/>`);
  return p.length ? `<w:rPr>${p.join("")}</w:rPr>` : "";
}

function run(text, opts) {
  return `<w:r>${runProps(opts)}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/** A single paragraph. `text` must not contain newlines (see `paras`). */
function para(text, opts = {}) {
  const { align, spaceBefore = 0, spaceAfter = 80, indent, ...runOpts } = opts;
  const pPr = [];
  if (indent) pPr.push(`<w:ind w:left="${indent}" w:hanging="${opts.hanging || 0}"/>`);
  pPr.push(`<w:spacing w:before="${spaceBefore}" w:after="${spaceAfter}"/>`);
  if (align) pPr.push(`<w:jc w:val="${align}"/>`);
  const body = String(text ?? "") === "" ? "" : run(text, runOpts);
  return `<w:p><w:pPr>${pPr.join("")}</w:pPr>${body}</w:p>`;
}

/** Split multi-line free text into separate paragraphs (Word ignores \n in runs). */
function paras(text, opts = {}) {
  return String(text || "")
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => para(l, opts))
    .join("");
}

function heading(text, level = 1) {
  const sizes = { 1: 40, 2: 30, 3: 26 };
  return para(text, {
    bold: true,
    size: sizes[level] || 26,
    color: NAVY,
    spaceBefore: level === 1 ? 0 : 240,
    spaceAfter: 120,
    align: level === 1 ? "center" : undefined,
  });
}

function numberedList(items) {
  if (!items || !items.length) return para("None recorded.", { color: "666666" });
  return items
    .map((t, i) => para(`${i + 1}. ${t}`, { indent: 360, spaceAfter: 40 }))
    .join("");
}

function cell(content, width, { header = false } = {}) {
  const shading = header
    ? `<w:shd w:val="clear" w:color="auto" w:fill="${NAVY}"/>`
    : "";
  const border = '<w:left w:val="single" w:sz="6" w:color="999999"/>';
  const borders = `<w:tcBorders><w:top w:val="single" w:sz="6" w:color="999999"/><w:bottom w:val="single" w:sz="6" w:color="999999"/>${border}<w:right w:val="single" w:sz="6" w:color="999999"/></w:tcBorders>`;
  const text = String(content ?? "").trim() || "—";
  const lines = text.split(/\n+/).filter(Boolean);
  const body = lines
    .map((l) =>
      para(l, {
        bold: header,
        color: header ? "FFFFFF" : undefined,
        size: header ? 20 : 20,
        spaceAfter: 20,
      }),
    )
    .join("");
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}${borders}<w:tcMar><w:top w:w="60" w:type="dxa"/><w:left w:w="90" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar></w:tcPr>${body || para("")}</w:tc>`;
}

const CONTENT_WIDTH = 9350; // A4 (11906 dxa) minus ~18mm margins each side

function docxTable(headers, rows, pcts) {
  if (!rows || !rows.length) return para("None recorded.", { color: "666666" });
  const widths = (pcts || headers.map(() => 1 / headers.length)).map((p) =>
    Math.round(CONTENT_WIDTH * p),
  );
  const grid = `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>`;
  const headRow = `<w:tr><w:trPr><w:tblHeader/></w:trPr>${headers
    .map((h, i) => cell(h, widths[i], { header: true }))
    .join("")}</w:tr>`;
  const bodyRows = rows
    .map(
      (r) => `<w:tr>${headers.map((_, i) => cell(r[i], widths[i])).join("")}</w:tr>`,
    )
    .join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${CONTENT_WIDTH}" w:type="dxa"/><w:tblLayout w:type="fixed"/></w:tblPr>${grid}${headRow}${bodyRows}</w:tbl>${para("")}`;
}

function qcObservationCell(row) {
  const hasStructured = QC_CHECKLIST_FIELDS.some(
    (f) => f.key !== "observations" && String(row?.[f.key] ?? "").trim(),
  );
  if (!hasStructured) return String(row?.observations || "");
  return QC_CHECKLIST_FIELDS.map(
    (f, i) => `${i + 1}. ${f.label}: ${String(row?.[f.key] ?? "").trim() || "—"}`,
  ).join("\n");
}

function imageParagraph(relId, widthEmu, heightEmu) {
  return `<w:p><w:pPr><w:jc w:val="center"/><w:spacing w:after="120"/></w:pPr><w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${widthEmu}" cy="${heightEmu}"/><wp:docPr id="1" name="Logo" descr="Logo"/><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="1" name="Logo"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="${relId}"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${widthEmu}" cy="${heightEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r></w:p>`;
}

/** Natural pixel size of an image buffer (0x0 when it can't be decoded). */
function measureImage(buf, mime) {
  return new Promise((resolve) => {
    try {
      const url = URL.createObjectURL(new Blob([buf], { type: mime }));
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve({ width: img.naturalWidth || 0, height: img.naturalHeight || 0 });
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve({ width: 0, height: 0 });
      };
      img.src = url;
    } catch {
      resolve({ width: 0, height: 0 });
    }
  });
}

async function fetchLogo(url) {
  if (!url) return null;
  try {
    const res = await fetch(url, { mode: "cors" });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (!buf.byteLength || buf.byteLength > 5 * 1024 * 1024) return null;
    const type = (res.headers.get("content-type") || "").toLowerCase();
    let ext = "png";
    if (type.includes("jpeg") || type.includes("jpg")) ext = "jpeg";
    else if (type.includes("gif")) ext = "gif";
    else if (/\.jpe?g(\?|$)/i.test(url)) ext = "jpeg";
    if (type.includes("svg") || /\.svg(\?|$)/i.test(url)) return null; // Word can't inline SVG reliably
    const dims = await measureImage(buf, type || `image/${ext}`);
    return { data: buf, ext, ...dims };
  } catch {
    return null;
  }
}

function documentXml(bodyXml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${bodyXml}<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1020" w:right="1020" w:bottom="1020" w:left="1020" w:header="708" w:footer="708" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="22"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="80" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style></w:styles>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`;

/** Builds the report body XML (everything inside <w:body> except sectPr). */
/** Fit the logo inside a max box (EMU) keeping its aspect ratio. */
function logoExtent(logo) {
  const MAX_W = 1600200; // ~1.75"
  const MAX_H = 1097280; // ~1.2"
  if (!logo?.width || !logo?.height) return [MAX_W, Math.round(MAX_W * 0.6)];
  const ratio = logo.width / logo.height;
  let h = MAX_H;
  let w = h * ratio;
  if (w > MAX_W) {
    w = MAX_W;
    h = w / ratio;
  }
  return [Math.round(w), Math.round(h)];
}

function buildBody(report, logoRelId, logo) {
  const c = report.cover || {};
  const edition = c.edition ? `${c.edition} ` : "";
  const out = [];

  if (logoRelId) {
    const [lw, lh] = logoExtent(logo);
    out.push(imageParagraph(logoRelId, lw, lh));
  }
  out.push(heading(c.institute_name || "", 1));
  out.push(para(c.centre_name || c.church_name || "", { bold: true, size: 28, align: "center" }));
  out.push(
    para(
      `${c.course_title || ""}${c.course_code ? ` – ${c.course_code}` : ""}`,
      { bold: true, size: 26, align: "center" },
    ),
  );
  if (c.edition) out.push(para(c.edition, { bold: true, size: 24, align: "center" }));
  if (c.date_range) out.push(para(c.date_range, { align: "center" }));
  out.push(para(""));

  out.push(heading("1. INTRODUCTION", 2));
  out.push(paras(report.introduction));

  out.push(heading("2. BIBLE SCHOOL FACULTY", 2));
  out.push(para("The Faculty/Committee comprises of the Coordinating Team listed as follows:"));
  out.push(numberedList(report.faculty?.coordinating));
  out.push(para("VOLUNTEERS INCLUDE:", { bold: true }));
  out.push(numberedList(report.faculty?.volunteers));

  out.push(heading("3. INDUCTION", 2));
  out.push(
    para(
      `The ${edition}induction took place on ${report.induction?.date || "—"} with ${
        report.induction?.students || "—"
      } students in attendance.`,
    ),
  );

  out.push(heading("4. CLASS ATTENDANCE", 2));
  out.push(para(`Class attendance was ${report.class_attendance || "—"}.`));

  out.push(heading("5a. STATISTICS", 2));
  out.push(para(`a. Total number of students, Water Baptised – ${report.stats_a?.water_baptised || "0"}`));
  out.push(para(`b. Total number of students, Holy Ghost Baptised – ${report.stats_a?.holy_ghost || "0"}`));
  out.push(para(`c. Total number of students, New birth – ${report.stats_a?.new_birth || "0"}`));
  out.push(para(`d. Total number of students, Testimonies Recorded – ${report.stats_a?.testimonies || "0"}`));

  out.push(heading("5b. REGISTRATION STATISTICS", 2));
  out.push(para(`Total number of registration forms received – ${report.stats_b?.forms_received || "0"}`));
  out.push(para(`Total number of registered and confirmed students – ${report.stats_b?.registered_confirmed || "0"}`));
  out.push(
    para(
      `Total number of students that completed all the courses and the required test – ${
        report.stats_b?.completed || "0"
      }`,
    ),
  );
  out.push(para(`Total number of students at Graduation Ceremony – ${report.stats_b?.at_graduation || "0"}`));
  out.push(para(`Total number of absentees – ${report.stats_b?.absentees || "0"}`));

  out.push(heading("6. NATIONS REPRESENTATION", 2));
  out.push(numberedList((report.nations || []).map((n) => `${n.name} – ${n.count}`)));

  out.push(heading("7. COURSES & LECTURERS", 2));
  out.push(
    docxTable(
      ["S/N", "COURSE", "CODE", "LECTURERS"],
      (report.courses || []).map((r, i) => [`${i + 1}.`, r.course, r.code, r.lecturer]),
      [0.08, 0.42, 0.15, 0.35],
    ),
  );

  out.push(heading("8. GENERAL FINDINGS AND OBSERVATIONS", 2));
  FINDING_FIELDS.forEach((f) => {
    out.push(para(f.label.toUpperCase(), { bold: true, underline: true, spaceBefore: 120, spaceAfter: 20 }));
    out.push(paras(report.findings?.[f.key]));
  });
  if (report.overall_performance) out.push(paras(report.overall_performance));
  if (report.next_session) out.push(paras(report.next_session));

  out.push(heading("9. STRIKING TESTIMONIES", 2));
  if ((report.testimonies || []).length) {
    (report.testimonies || []).forEach((t) => {
      out.push(
        para((t.heading || "Testimony").toUpperCase(), {
          bold: true,
          underline: true,
          spaceBefore: 120,
          spaceAfter: 20,
        }),
      );
      out.push(paras(t.body));
      if (t.name) out.push(para(t.name, { bold: true }));
    });
  } else {
    out.push(para("None recorded.", { color: "666666" }));
  }

  out.push(heading("10. STUDENT FEEDBACK ON LECTURERS", 2));
  if (report.feedback_intro) out.push(paras(report.feedback_intro));
  out.push(
    docxTable(
      ["LECTURER", "COURSE", "QC PERSONNEL", "STUDENT RATINGS"],
      (report.student_feedback || []).map((r) => [
        r.lecturer,
        r.course,
        r.qc_person,
        `1. Quality control Rating – ${r.qc_rating || "—"}\n2. Student Average Rating – ${
          r.student_rating || "—"
        }`,
      ]),
      [0.25, 0.27, 0.2, 0.28],
    ),
  );

  out.push(heading("11. QUALITY CONTROL – FEEDBACK ON LECTURERS", 2));
  out.push(
    docxTable(
      ["LECTURER", "COURSE", "QC PERSONNEL", "GENERAL OBSERVATIONS"],
      (report.qc || []).map((r) => [r.lecturer, r.course, r.qc_person, qcObservationCell(r)]),
      [0.22, 0.24, 0.18, 0.36],
    ),
  );

  out.push(heading("13. HONORARIUM RECOMMENDATION", 2));
  if (report.honorarium_heading) out.push(heading(report.honorarium_heading, 3));
  out.push(
    docxTable(
      ["S/N", "COURSE", "CODE", "LECTURERS", "TYPE", "REMARKS"],
      (report.honorarium || []).map((r, i) => [
        `${i + 1}.`,
        r.course,
        r.code,
        r.lecturer,
        r.type,
        r.remarks,
      ]),
      [0.06, 0.3, 0.12, 0.24, 0.12, 0.16],
    ),
  );

  out.push(heading("HONORARIUM MATRIX", 3));
  out.push(
    docxTable(
      [
        "S/N",
        "APPROVED LECTURERS",
        "NO. OF COURSES",
        `RECOMMENDED HONORARIUM (£${report.honorarium_matrix?.rate ?? 0} PER COURSE)`,
        "SIGNED CONTRACT OF SERVICE (COS)/ PAYROLL",
      ],
      (report.honorarium_matrix?.rows || []).map((r, i) => [
        `${i + 1}.`,
        r.lecturer,
        r.courses,
        r.amount,
        r.cos,
      ]),
      [0.06, 0.3, 0.14, 0.26, 0.24],
    ),
  );

  if (report.closing_remark) {
    out.push(heading("REMARK", 3));
    out.push(paras(report.closing_remark));
  }
  if (report.signoff?.name || report.signoff?.title) {
    out.push(para(""));
    if (report.signoff?.name) out.push(para(report.signoff.name, { bold: true, spaceAfter: 20 }));
    if (report.signoff?.title) out.push(para(report.signoff.title));
  }

  return out.join("");
}

/** Returns a Blob containing a valid .docx package. */
export async function buildReportDocx(report) {
  const zip = new JSZip();
  const logo = await fetchLogo(report?.cover?.logo_url);
  const logoRelId = logo ? "rId10" : null;

  zip.file(
    "[Content_Types].xml",
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Default Extension="jpeg" ContentType="image/jpeg"/><Default Extension="gif" ContentType="image/gif"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>`,
  );
  zip.folder("_rels").file(".rels", RELS_XML);
  const word = zip.folder("word");
  word.file("styles.xml", STYLES_XML);
  word.file("document.xml", documentXml(buildBody(report, logoRelId, logo)));

  const rels = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>',
  ];
  if (logo) {
    word.folder("media").file(`logo.${logo.ext}`, logo.data);
    rels.push(
      `<Relationship Id="${logoRelId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/logo.${logo.ext}"/>`,
    );
  }
  word
    .folder("_rels")
    .file(
      "document.xml.rels",
      `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${rels.join("")}</Relationships>`,
    );

  return zip.generateAsync({
    type: "blob",
    mimeType:
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    compression: "DEFLATE",
  });
}
