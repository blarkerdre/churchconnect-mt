import { toImageDataUrl } from "@/lib/logo-data-url";

/**
 * Shared attendance roster export helpers.
 *
 * A roster object looks like:
 * {
 *   title:   "Sunday Service — 12 Jan 2026",
 *   orgName: "Tenant name",
 *   logoUrl: "https://.../logo.png"   (optional, resolved to a data URL when printing)
 *   meta:    [["Type", "Sunday Service"], ["Date", "2026-01-12"]],
 *   summary: [["Total", 42], ["Present", 30], ["Absent", 12], ["Rate", "71%"]],
 *   headers: ["#", "Name", "Unit", "Status", "Check-in"],
 *   rows:    [[1, "Jane Doe", "Choir", "Present", "09:12"]],
 *   filename:"sunday-service-2026-01-12"
 * }
 */

export function escHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function csvCell(v) {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export function buildRosterCsv(roster) {
  const lines = [];
  lines.push([roster.title].map(csvCell).join(","));
  if (roster.orgName) lines.push([roster.orgName].map(csvCell).join(","));
  for (const [label, value] of roster.meta || []) lines.push([label, value].map(csvCell).join(","));
  lines.push("");
  lines.push((roster.headers || []).map(csvCell).join(","));
  for (const row of roster.rows || []) lines.push(row.map(csvCell).join(","));
  if ((roster.summary || []).length) {
    lines.push("");
    for (const [label, value] of roster.summary) lines.push([label, value].map(csvCell).join(","));
  }
  lines.push("");
  lines.push([`Generated ${new Date().toLocaleString("en-GB")}`].map(csvCell).join(","));
  return lines.join("\n");
}

function slugify(str) {
  return String(str || "roster")
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .toLowerCase()
    .slice(0, 80);
}

export function downloadRosterCsv(roster) {
  const csv = buildRosterCsv(roster);
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slugify(roster.filename || roster.title)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function rosterHtml(roster, logo) {
  const statusClass = (v) => {
    const s = String(v || "").toLowerCase();
    if (s === "present") return "st-present";
    if (s === "late") return "st-late";
    if (s === "absent") return "st-absent";
    if (s === "excused") return "st-excused";
    return "";
  };
  const statusIdx = (roster.headers || []).findIndex((h) => String(h).toLowerCase() === "status");

  const body = (roster.rows || [])
    .map(
      (r) =>
        `<tr>${r
          .map((c, i) => {
            const cls = i === statusIdx ? statusClass(c) : "";
            return `<td class="${cls}">${escHtml(c)}</td>`;
          })
          .join("")}</tr>`
    )
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8" />
<title>${escHtml(roster.title)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11.5px; color: #111827; margin: 0; }
  .head { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #1e3a5f; padding-bottom: 10px; margin-bottom: 12px; }
  .head img { max-height: 62px; max-width: 180px; object-fit: contain; }
  .head .txt { flex: 1; }
  .org { font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: #64748b; margin: 0 0 2px; }
  h1 { font-size: 17px; margin: 0; color: #1e3a5f; }
  .meta { margin: 0 0 12px; font-size: 11px; color: #475569; }
  .meta span { margin-right: 14px; white-space: nowrap; }
  .summary { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .summary div { border: 1px solid #e2e8f0; border-radius: 6px; padding: 6px 12px; min-width: 84px; }
  .summary b { display: block; font-size: 15px; color: #1e3a5f; }
  .summary small { color: #64748b; font-size: 10px; text-transform: uppercase; letter-spacing: .04em; }
  table { width: 100%; border-collapse: collapse; }
  thead { display: table-header-group; }
  th { background: #1e3a5f; color: #fff; text-align: left; padding: 7px 8px; font-size: 10.5px; text-transform: uppercase; letter-spacing: .03em; }
  td { padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
  tr { page-break-inside: avoid; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  td.st-present { color: #15803d; font-weight: 700; }
  td.st-late { color: #b45309; font-weight: 700; }
  td.st-absent { color: #b91c1c; font-weight: 700; }
  td.st-excused { color: #1d4ed8; font-weight: 700; }
  .foot { margin-top: 14px; font-size: 10px; color: #94a3b8; }
</style></head><body>
  <div class="head">
    ${logo?.dataUrl ? `<img src="${logo.dataUrl}" alt="" />` : ""}
    <div class="txt">
      ${roster.orgName ? `<p class="org">${escHtml(roster.orgName)}</p>` : ""}
      <h1>${escHtml(roster.title)}</h1>
    </div>
  </div>
  <p class="meta">${(roster.meta || [])
    .map(([l, v]) => `<span><strong>${escHtml(l)}:</strong> ${escHtml(v)}</span>`)
    .join("")}</p>
  ${
    (roster.summary || []).length
      ? `<div class="summary">${roster.summary
          .map(([l, v]) => `<div><b>${escHtml(v)}</b><small>${escHtml(l)}</small></div>`)
          .join("")}</div>`
      : ""
  }
  <table>
    <thead><tr>${(roster.headers || []).map((h) => `<th>${escHtml(h)}</th>`).join("")}</tr></thead>
    <tbody>${body || `<tr><td colspan="${(roster.headers || []).length}">No records</td></tr>`}</tbody>
  </table>
  <p class="foot">Generated ${escHtml(new Date().toLocaleString("en-GB"))}</p>
</body></html>`;
}

/**
 * Opens the browser print dialog with a print-ready roster ("Save as PDF").
 * Renders in a hidden iframe so it works on mobile/PWA where popups are blocked.
 */
export async function printRosterPdf(roster) {
  let logo = null;
  if (roster.logoUrl) {
    try {
      logo = await toImageDataUrl(roster.logoUrl);
    } catch {
      logo = null;
    }
  }
  const html = rosterHtml(roster, logo);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.position = "fixed";
  iframe.style.right = "0";
  iframe.style.bottom = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  document.body.appendChild(iframe);

  const cleanup = () => {
    setTimeout(() => {
      if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
    }, 1000);
  };

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) {
    cleanup();
    throw new Error("Unable to open the print view");
  }
  doc.open();
  doc.write(html);
  doc.close();

  await new Promise((resolve) => setTimeout(resolve, 350));
  try {
    iframe.contentWindow.focus();
    iframe.contentWindow.print();
  } finally {
    cleanup();
  }
}
