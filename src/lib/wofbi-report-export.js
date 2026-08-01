// Print / Word export for the Bible School course final report.
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

function table(headers, rows) {
  if (!rows.length) return `<p class="muted">None recorded.</p>`;
  return `<table>
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
  const title = `${c.course_title || "Course"} Report`;

  const body = `
    <div class="cover">
      ${c.logo_url ? `<img class="logo" src="${escHtml(c.logo_url)}" alt="Logo" />` : ""}
      <h1>${escHtml(c.institute_name || "")}</h1>
      <h2>${escHtml(c.centre_name || c.church_name || "")}</h2>
      <h3>${escHtml(c.course_title || "")}${c.course_code ? ` – ${escHtml(c.course_code)}` : ""}</h3>
      <h3>${escHtml(c.edition || "")}</h3>
      <p>${escHtml(c.date_range || "")}</p>
    </div>

    <h2>1. Introduction</h2>
    ${paras(report.introduction)}

    <h2>2. Bible School Faculty</h2>
    <p><strong>Coordinating team</strong></p>
    ${list(report.faculty?.coordinating)}
    <p><strong>Volunteers</strong></p>
    ${list(report.faculty?.volunteers)}

    <h2>3. Induction</h2>
    <p>Induction held on ${escHtml(report.induction?.date || "—")} with ${escHtml(
      report.induction?.students || "—",
    )} students in attendance.</p>

    <h2>4. Class attendance</h2>
    <p>Class attendance was ${escHtml(report.class_attendance || "—")}.</p>

    <h2>5a. Statistics</h2>
    <ul>
      <li>Total number of students, Water Baptised – ${escHtml(report.stats_a?.water_baptised || "0")}</li>
      <li>Total number of students, Holy Ghost Baptised – ${escHtml(report.stats_a?.holy_ghost || "0")}</li>
      <li>Total number of students, New birth – ${escHtml(report.stats_a?.new_birth || "0")}</li>
      <li>Total number of students, Testimonies Recorded – ${escHtml(report.stats_a?.testimonies || "0")}</li>
    </ul>

    <h2>5b. Registration statistics</h2>
    <ul>
      <li>Total number of registration forms received – ${escHtml(report.stats_b?.forms_received || "0")}</li>
      <li>Total number of registered and confirmed students – ${escHtml(report.stats_b?.registered_confirmed || "0")}</li>
      <li>Total number of students that completed all the courses and the required test – ${escHtml(report.stats_b?.completed || "0")}</li>
      <li>Total number of students at Graduation Ceremony – ${escHtml(report.stats_b?.at_graduation || "0")}</li>
      <li>Total number of absentees – ${escHtml(report.stats_b?.absentees || "0")}</li>
    </ul>

    <h2>6. Nations representation</h2>
    ${list((report.nations || []).map((n) => `${n.name} – ${n.count}`))}

    <h2>7. Courses & lecturers</h2>
    ${table(
      ["S/N", "Course", "Code", "Lecturer"],
      (report.courses || []).map((r, i) => [i + 1, r.course, r.code, r.lecturer]),
    )}

    <h2>8. General findings and observations</h2>
    ${FINDING_FIELDS.map(
      (f) =>
        `<p><strong>${escHtml(f.label)}</strong></p>${paras(report.findings?.[f.key])}`,
    ).join("")}
    ${report.overall_performance ? paras(report.overall_performance) : ""}

    <h2>9. Striking testimonies</h2>
    ${
      (report.testimonies || []).length
        ? (report.testimonies || [])
            .map(
              (t) =>
                `<h4>${escHtml(t.heading || "Testimony")}</h4>${paras(t.body)}<p><em>${escHtml(t.name || "")}</em></p>`,
            )
            .join("")
        : `<p class="muted">None recorded.</p>`
    }

    <h2>10. Student feedback on lecturers</h2>
    ${table(
      ["Lecturer", "Course", "QC personnel", "QC rating", "Student average rating"],
      (report.student_feedback || []).map((r) => [
        r.lecturer,
        r.course,
        r.qc_person,
        r.qc_rating,
        r.student_rating,
      ]),
    )}

    <h2>11. Quality control – feedback on lecturers</h2>
    ${table(
      ["Lecturer", "Course", "QC personnel", "General observations"],
      (report.qc || []).map((r) => [r.lecturer, r.course, r.qc_person, r.observations]),
    )}

    <h2>12. Honorarium recommendation</h2>
    ${table(
      ["S/N", "Course", "Code", "Lecturer", "Type", "Remarks"],
      (report.honorarium || []).map((r, i) => [
        i + 1,
        r.course,
        r.code,
        r.lecturer,
        r.type,
        r.remarks,
      ]),
    )}

    <h2>Honorarium matrix</h2>
    ${table(
      [
        "S/N",
        "Approved lecturer",
        "No. of courses",
        `Recommended honorarium (£${report.honorarium_matrix?.rate ?? 0} per course)`,
        "Signed COS / payroll",
      ],
      (report.honorarium_matrix?.rows || []).map((r, i) => [
        i + 1,
        r.lecturer,
        r.courses,
        r.amount,
        r.cos,
      ]),
    )}

    <h2>13. Next session</h2>
    ${paras(report.next_session)}
  `;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8" /><title>${escHtml(title)}</title>
<style>
  body { font-family: Arial, sans-serif; font-size: 12px; color: #111; margin: 28px; }
  .cover { text-align: center; margin-bottom: 28px; }
  .cover .logo { max-height: 90px; margin-bottom: 8px; }
  h1 { font-size: 20px; color: #1e3a5f; margin: 4px 0; }
  h2 { font-size: 15px; color: #1e3a5f; margin: 18px 0 6px; }
  h3 { font-size: 13px; margin: 3px 0; }
  h4 { font-size: 12px; margin: 12px 0 3px; }
  p, li { line-height: 1.5; }
  .muted { color: #666; font-style: italic; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 12px; }
  th { background: #1e3a5f; color: #fff; text-align: left; padding: 6px 8px; font-size: 11px; }
  td { padding: 6px 8px; border-bottom: 1px solid #d9d9d9; vertical-align: top; }
  @media print { body { margin: 0; } h2 { page-break-after: avoid; } table { page-break-inside: avoid; } }
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
