import { jsPDF } from "jspdf";

/**
 * Replace {{tokens}} inside an HTML/text template body with values.
 * Unknown tokens are left in place so authors notice.
 */
export function mergeSlaTokens(bodyHtml, tokens) {
  if (!bodyHtml) return "";
  return bodyHtml.replace(/\{\{\s*([\w.-]+)\s*\}\}/g, (m, key) => {
    const v = tokens?.[key];
    return v === undefined || v === null || v === "" ? m : String(v);
  });
}

export const SLA_TOKENS = [
  "tenant_name",
  "tenant_slug",
  "owner_name",
  "owner_email",
  "effective_date",
  "plan_name",
  "app_name",
];

/** Very small HTML → plain-text with heading/paragraph preservation. */
function htmlToBlocks(html) {
  if (!html) return [];
  // Normalise line breaks
  const cleaned = html
    .replace(/\r\n?/g, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|h[1-6])>/gi, "\n\n")
    .replace(/<li[^>]*>/gi, "• ")
    .replace(/<h([1-6])[^>]*>/gi, (_, n) => `\u0001H${n}\u0001`)
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  return cleaned
    .split(/\n{2,}/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((block) => {
      const m = block.match(/^\u0001H([1-6])\u0001([\s\S]*)$/);
      if (m) return { type: "heading", level: Number(m[1]), text: m[2].trim() };
      return { type: "para", text: block };
    });
}

/**
 * Generate an SLA PDF (jsPDF) from merged body HTML + optional signature block.
 * Returns a Blob-safe jsPDF instance; call `.save(name)` or `.output("blob")`.
 */
export function buildSlaPdf({ title, bodyHtml, tokens, signature }) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 56;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  const addPageIfNeeded = (needed) => {
    if (y + needed > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  const titleLines = doc.splitTextToSize(title || "Service Level Agreement", maxWidth);
  doc.text(titleLines, margin, y);
  y += titleLines.length * 22 + 6;

  // Metadata line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const meta = [
    tokens?.tenant_name ? `Church: ${tokens.tenant_name}` : null,
    tokens?.effective_date ? `Effective: ${tokens.effective_date}` : null,
    tokens?.plan_name ? `Plan: ${tokens.plan_name}` : null,
  ]
    .filter(Boolean)
    .join("   •   ");
  if (meta) {
    doc.setTextColor(120);
    doc.text(meta, margin, y);
    doc.setTextColor(0);
    y += 18;
  }

  doc.setDrawColor(200);
  doc.line(margin, y, pageWidth - margin, y);
  y += 18;

  // Body
  const merged = mergeSlaTokens(bodyHtml || "", tokens || {});
  const blocks = htmlToBlocks(merged);
  for (const block of blocks) {
    if (block.type === "heading") {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(block.level <= 2 ? 14 : 12);
      const lines = doc.splitTextToSize(block.text, maxWidth);
      addPageIfNeeded(lines.length * 18 + 6);
      doc.text(lines, margin, y);
      y += lines.length * 18 + 4;
    } else {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(11);
      const lines = doc.splitTextToSize(block.text, maxWidth);
      addPageIfNeeded(lines.length * 15 + 4);
      doc.text(lines, margin, y);
      y += lines.length * 15 + 8;
    }
  }

  // Signature block
  if (signature) {
    addPageIfNeeded(120);
    y += 10;
    doc.setDrawColor(180);
    doc.line(margin, y, pageWidth - margin, y);
    y += 16;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.text("Signed", margin, y);
    y += 18;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(11);
    const rows = [
      `Name: ${signature.name || ""}`,
      `Email: ${signature.email || ""}`,
      `Signed at: ${signature.signed_at || ""}`,
      signature.template_version != null ? `Template version: v${signature.template_version}` : null,
      signature.ip_address ? `IP: ${signature.ip_address}` : null,
    ].filter(Boolean);
    for (const r of rows) {
      addPageIfNeeded(15);
      doc.text(r, margin, y);
      y += 15;
    }
    y += 6;
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text(
      "This document was signed electronically by typing the signatory's full name and confirming agreement.",
      margin,
      y,
      { maxWidth }
    );
    doc.setTextColor(0);
  }

  return doc;
}

export function downloadSlaPdf(args, filename = "service-level-agreement.pdf") {
  const doc = buildSlaPdf(args);
  doc.save(filename);
}

export const DEFAULT_SLA_BODY = `<h1>Service Level Agreement</h1>
<p>This Service Level Agreement ("SLA") is entered into between {{app_name}} (the "Provider") and {{tenant_name}} (the "Customer") with effect from {{effective_date}}.</p>

<h2>1. Service</h2>
<p>The Provider shall make the {{app_name}} platform available to the Customer on the {{plan_name}} plan.</p>

<h2>2. Availability</h2>
<p>The Provider will use commercially reasonable efforts to maintain 99.5% monthly uptime, excluding scheduled maintenance windows.</p>

<h2>3. Support</h2>
<p>Support requests may be raised via the in-app help channel. Standard response time is one business day.</p>

<h2>4. Data & Privacy</h2>
<p>Customer data is hosted in the UK (eu-west-2 region). The Provider processes data in accordance with the Privacy Policy referenced within the application.</p>

<h2>5. Term</h2>
<p>This SLA remains in force for so long as the Customer maintains an active subscription.</p>

<h2>6. Acceptance</h2>
<p>Signed on behalf of the Customer by {{owner_name}} ({{owner_email}}).</p>`;
