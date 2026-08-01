// Print / Word export for the Bible School course final report.
// Layout mirrors the Cardiff WOFBI report template (headings + tables).
import { FINDING_FIELDS } from "@/lib/wofbi-report-defaults";

export function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function paras(text) {
  return String(text || "")
    .split(/\n{1,}/)
    .filter((l) => l.trim())
    .map((l) => `<p>${escHtml(l)}</p>`)
    .join("");
}

function table(headers, rows, widths) {
  if (!rows.length) return `<p class="muted">None recorded.</p>`;
  const cols = widths
    ? `<colgroup>${widths.map((w) => `<col style="width:${w}" />`).join("")}</colgroup>`
    : "";
  return `<table>
    ${cols}
    <thead><tr>${headers.map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${rows
      .map((r) => `<tr>${r.map((c) => `<td>${escHtml(c)}</td>`).join("")}</tr>`)
      .join("")}</tbody>
  </table>`;
}

function list(items) {
  if (!items || !items.length) return `<p class="muted">None recorded.</p>`;
  return `<ol>${items.map((i) => `<li>${escHtml(i)}</li>`).join("")}</ol>`;
}

export function buildReportHtml(report) {
  const c = report.cover || {};
  const edition = c.edition ? `${c.edition} ` : "";
  const title = `${c.course_title || "Course"} Report`;

  const body = `
    <div class="cover">
      ${c.logo_url ? `<img class="logo" src="${escHtml(c.logo_url)}" alt="Logo" />` : ""}
      <h1>${escHtml(c.institute_name || "")}</h1>
      <h2 class="plain">${escHtml(c.centre_name || c.church_name || "")}</h2>
      <h3>${escHtml(c.course_title || "")}${c.course_code ? ` – ${escHtml(c.course_code)}` : ""}</h3>
      <h3>${escHtml(c.edition || "")}</h3>
      <p>${escHtml(c.date_range || "")}</p>
    </div>

    <h2>1. INTRODUCTION</h2>
    ${paras(report.introduction)}

    <h2>2. BIBLE SCHOOL FACULTY</h2>
    <p>The Faculty/Committee comprises of the Coordinating Team listed as follows:</p>
    ${list(report.faculty?.coordinating)}
    <p><strong>VOLUNTEERS INCLUDE:</strong></p>
    ${list(report.faculty?.volunteers)}

    <h2>3. INDUCTION</h2>
    <p>The ${escHtml(edition)}induction took place on ${escHtml(
      report.induction?.date || "—",
    )} with ${escHtml(report.induction?.students || "—")} students in attendance.</p>

    <h2>4. CLASS ATTENDANCE</h2>
    <p>Class attendance was ${escHtml(report.class_attendance || "—")}.</p>

    <h2>5a. STATISTICS</h2>
    <p>a. Total number of students, Water Baptised – ${escHtml(report.stats_a?.water_baptised || "0")}</p>
    <p>b. Total number of students, Holy Ghost Baptised – ${escHtml(report.stats_a?.holy_ghost || "0")}</p>
    <p>c. Total number of students, New birth – ${escHtml(report.stats_a?.new_birth || "0")}</p>
    <p>d. Total number of students, Testimonies Recorded – ${escHtml(report.stats_a?.testimonies || "0")}</p>

    <h2>5b. REGISTRATION STATISTICS</h2>
    <p>Total number of registration forms received – ${escHtml(report.stats_b?.forms_received || "0")}</p>
    <p>Total number of registered and confirmed students – ${escHtml(report.stats_b?.registered_confirmed || "0")}</p>
    <p>Total number of students that completed all the courses and the required test – ${escHtml(report.stats_b?.completed || "0")}</p>
    <p>Total number of students at Graduation Ceremony – ${escHtml(report.stats_b?.at_graduation || "0")}</p>
    <p>Total number of absentees – ${escHtml(report.stats_b?.absentees || "0")}</p>

    <h2>6. NATIONS REPRESENTATION</h2>
    ${list((report.nations || []).map((n) => `${n.name} – ${n.count}`))}

    <h2>7. COURSES &amp; LECTURERS</h2>
    ${table(
      ["S/N", "COURSE", "CODE", "LECTURERS"],
      (report.courses || []).map((r, i) => [`${i + 1}.`, r.course, r.code, r.lecturer]),
      ["8%", "42%", "15%", "35%"],
    )}

    <h2>8. GENERAL FINDINGS AND OBSERVATIONS</h2>
    ${FINDING_FIELDS.map(
      (f) =>
        `<p class="finding">${escHtml(f.label.toUpperCase())}</p>${paras(report.findings?.[f.key])}`,
    ).join("")}
    ${report.overall_performance ? paras(report.overall_performance) : ""}

    <h2>9. STRIKING TESTIMONIES</h2>
    ${
      (report.testimonies || []).length
        ? (report.testimonies || [])
            .map(
              (t) =>
                `<h4>${escHtml((t.heading || "Testimony").toUpperCase())}</h4>${paras(t.body)}<p><strong>${escHtml(
                  t.name || "",
                )}</strong></p>`,
            )
            .join("")
        : `<p class="muted">None recorded.</p>`
    }

    <h2>10. STUDENT FEEDBACK ON LECTURERS</h2>
    ${table(
      ["LECTURER", "COURSE", "QC PERSONNEL", "RATINGS"],
      (report.student_feedback || []).map((r) => [
        r.lecturer,
        r.course,
        r.qc_person,
        `1. Quality control Rating – ${r.qc_rating || "—"}\n2. Student Average Rating – ${r.student_rating || "—"}`,
      ]),
      ["25%", "27%", "20%", "28%"],
    )}

    <h2>11. QUALITY CONTROL – FEEDBACK ON LECTURERS</h2>
    ${table(
      ["LECTURER", "COURSE", "QC PERSONNEL", "GENERAL OBSERVATIONS"],
      (report.qc || []).map((r) => [r.lecturer, r.course, r.qc_person, r.observations]),
      ["22%", "24%", "18%", "36%"],
    )}

    <h2>12. HONORARIUM RECOMMENDATION</h2>
    ${table(
      ["S/N", "COURSE", "CODE", "LECTURERS", "TYPE", "REMARKS"],
      (report.honorarium || []).map((r, i) => [
        `${i + 1}.`,
        r.course,
        r.code,
        r.lecturer,
        r.type,
        r.remarks,
      ]),
      ["6%", "30%", "12%", "24%", "12%", "16%"],
    )}

    <h3 class="section">HONORARIUM MATRIX</h3>
    ${table(
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
      ["6%", "30%", "14%", "26%", "24%"],
    )}

    <h2>13. NEXT SESSION</h2>
    ${paras(report.next_session)}
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 28px; }
  .cover { text-align: center; margin-bottom: 28px; }
  .cover .logo { max-height: 120px; margin-bottom: 8px; }
  h1 { font-size: 20px; color: #1e3a5f; margin: 4px 0; text-transform: uppercase; }
  h2 { font-size: 15px; color: #1e3a5f; margin: 18px 0 6px; text-transform: uppercase; }
  h2.plain { text-transform: none; }
  h3 { font-size: 13px; margin: 3px 0; }
  h3.section { font-size: 13px; color: #1e3a5f; margin: 14px 0 4px; text-transform: uppercase; }
  h4 { font-size: 12px; margin: 12px 0 3px; text-decoration: underline; }
  p, li { line-height: 1.5; }
  p.finding { font-weight: bold; text-decoration: underline; margin-bottom: 2px; }
  .muted { color: #666; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; table-layout: fixed; }
  th, td { border: 1px solid #999; padding: 6px 8px; vertical-align: top; word-wrap: break-word; white-space: pre-line; }
  th { background: #1e3a5f; color: #fff; text-align: left; font-size: 11px; text-transform: uppercase; }
  @media print { body { margin: 0; } h2 { page-break-after: avoid; } table, tr { page-break-inside: avoid; } }
</style></head><body>${body}</body></html>`;
}

export function printReport(report) {
  const html = buildReportHtml(report);
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  win.print();
}

export function downloadReportDoc(report) {
  const html = buildReportHtml(report);
  const blob = new Blob(["\ufeff", html], { type: "application/msword" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const name = `${(report.cover?.course_title || "course").replace(/[^A-Za-z0-9]+/g, "_")}_report.doc`;
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
