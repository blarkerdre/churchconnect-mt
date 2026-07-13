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

export const DEFAULT_SLA_BODY = `<h1>ChurchConnect — Service Level Agreement</h1>
<p><em>Church Management Suite</em></p>
<p><strong>Between DomiFort Solutions Limited (trading as "ChurchConnect") and {{tenant_name}}</strong></p>
<p>Version 1.0 · Effective {{effective_date}} · Governing law: England &amp; Wales</p>

<h2>1. Parties and Effective Date</h2>
<p>This Service Level Agreement ("<strong>SLA</strong>") is entered into between <strong>DomiFort Solutions Limited</strong>, a company incorporated in England &amp; Wales, trading as "<strong>ChurchConnect</strong>" (the "<strong>Service Provider</strong>"), and <strong>{{tenant_name}}</strong> (the "<strong>Customer</strong>" or "<strong>Tenant</strong>"), acting through its authorised representative {{owner_name}} ({{owner_email}}).</p>
<p>This SLA takes effect on the date signed by both parties (or, if no signature is executed, on the date the Customer first accesses the Service) and remains in force for so long as the Customer maintains an active tenant on the platform. The version and effective date of this document are shown above (v1.0, {{effective_date}}).</p>
<p><em>This document is a template provided by the Service Provider and should be reviewed by the Customer's own legal counsel before signature.</em></p>

<h2>2. Definitions</h2>
<ul>
  <li><strong>Service</strong> — the {{app_name}} multi-tenant church management web application and associated background services made available to the Customer.</li>
  <li><strong>Tenant</strong> — the isolated logical instance of the Service allocated to the Customer, including its members, attendance, communications and configuration data.</li>
  <li><strong>Uptime</strong> — the percentage of time in a calendar month during which the Service is materially available to authenticated users, excluding Scheduled Maintenance and the exclusions listed in section 4.</li>
  <li><strong>Downtime</strong> — a period in which the Service is not materially available to authenticated users due to a fault attributable to the Service Provider.</li>
  <li><strong>Scheduled Maintenance</strong> — planned work notified in advance in accordance with section 5.</li>
  <li><strong>Support Hours</strong> — 09:00–17:30 UK time, Monday to Friday, excluding UK public holidays.</li>
  <li><strong>Incident</strong> — a reproducible fault, defect or availability issue reported by the Customer.</li>
  <li><strong>Severity</strong> — the classification assigned to an Incident as defined in section 6.</li>
  <li><strong>Personal Data</strong> — has the meaning given in the UK GDPR.</li>
</ul>

<h2>3. Scope of Service</h2>
<p>The Service is a comprehensive, multi-tenant church management platform provided as software-as-a-service. It includes the following modules, as enabled for the Customer's {{plan_name}} plan: member directory and lifecycle management, church attendance and self check-in, communications (email, SMS, WhatsApp, voice and in-app announcements), follow-ups and sign-posting, pastoral care and prayer requests, events and registrations, Children Church check-in and pickup, transportation and ride bookings, Bible School (exams and results), Home Cells, unit tasks and rosters, sermon notes, testimonies, reports, and tenant administration.</p>
<p>The Service is hosted with customer data stored in the United Kingdom region (eu-west-2). Financial accounting is expressly excluded from the scope of the Service.</p>

<h2>4. Service Availability</h2>
<h3>4.1 Target</h3>
<p>The Service Provider targets an <strong>Uptime of 99.5% per calendar month</strong>, equating to no more than approximately 3 hours 40 minutes of unplanned Downtime per month.</p>
<h3>4.2 Measurement</h3>
<p>Uptime is measured by the Service Provider's monitoring of the primary web application and authenticated API endpoints, averaged across the calendar month. Availability of individual optional integrations is not included in the Uptime calculation.</p>
<h3>4.3 Exclusions</h3>
<p>The following do not count as Downtime:</p>
<ul>
  <li>Scheduled Maintenance carried out in accordance with section 5.</li>
  <li>Emergency maintenance required to address a security, integrity or availability risk.</li>
  <li>Failures caused by the Customer, its users, its content, or its configuration (including tenant-level feature toggles and role assignments).</li>
  <li>Failures of third-party providers configured by or on behalf of the Customer, including SMS, WhatsApp, voice, email delivery, payment processing, mapping and geocoding.</li>
  <li>Force majeure events, including internet backbone outages, DDoS attacks, government action, natural disasters and pandemics.</li>
  <li>Beta, preview, experimental or explicitly labelled 'test' features.</li>
</ul>

<h2>5. Scheduled Maintenance</h2>
<p>The Service Provider will endeavour to perform Scheduled Maintenance outside UK peak service hours (typically Sunday-morning worship windows) and to provide the Customer's tenant administrator with at least <strong>48 hours' notice</strong> for standard maintenance and best-effort notice for emergency maintenance. Scheduled Maintenance is excluded from the Uptime calculation.</p>

<h2>6. Support</h2>
<h3>6.1 Channels</h3>
<p>Support is delivered via in-app feedback, email to the Customer's tenant administrator (who forwards to the Service Provider's development team) and, where enabled, direct email to the Service Provider. The tenant administrator is the primary point of contact for members of the Customer's church.</p>
<h3>6.2 Severity and Response Targets</h3>
<p>The Service Provider will use reasonable endeavours to acknowledge and begin work on Incidents within the following response targets during Support Hours. <strong>Response times are targets for acknowledgement and initial engagement; they are not guaranteed resolution times.</strong></p>
<table>
  <thead>
    <tr><th>Severity</th><th>Definition</th><th>Response Target</th></tr>
  </thead>
  <tbody>
    <tr><td><strong>P1 — Critical</strong></td><td>The Service is unavailable or a core module is unusable for the whole tenant with no workaround.</td><td>Within 4 business hours</td></tr>
    <tr><td><strong>P2 — Major</strong></td><td>A significant feature is materially impaired for many users, or a workaround exists but is costly.</td><td>Within 1 business day</td></tr>
    <tr><td><strong>P3 — Minor</strong></td><td>Cosmetic issue, question, minor bug, feature request or single-user issue.</td><td>Within 3 business days</td></tr>
  </tbody>
</table>
<h3>6.3 Support Hours</h3>
<p>Support is provided during Support Hours (Monday to Friday, 09:00–17:30 UK time, excluding UK public holidays). Requests received outside Support Hours are treated as received at the start of the next business day.</p>

<h2>7. Remedies — No Service Credits</h2>
<p>The remedies available to the Customer for failure to meet the Uptime target or the response targets in section 6 are limited to (a) corrective action by the Service Provider, (b) prioritised support, and (c) where a persistent and material failure continues for two or more consecutive months, the Customer's right to terminate as set out in section 14.</p>
<p><strong>The Service Provider does not offer financial service credits or refunds under this SLA.</strong> This clause represents the Customer's sole and exclusive remedy in relation to Uptime and response-time performance.</p>

<h2>8. Customer Responsibilities</h2>
<p>The Customer is responsible for:</p>
<ul>
  <li>Accurate tenant configuration, including feature toggles, branding, roles and church units.</li>
  <li>Provisioning and de-provisioning user accounts, and assigning appropriate roles (owner, admin, leader, member, reports officer, etc.).</li>
  <li>The content and lawfulness of all communications sent through the Service (email, SMS, WhatsApp, voice, announcements).</li>
  <li>Maintaining its own accounts with third-party providers (for example Twilio, email delivery providers, Stripe, mapping and geocoding services) and paying their charges directly.</li>
  <li>Handling data-subject requests received from its members, including access, correction, export and deletion.</li>
  <li>Safeguarding oversight for Children Church, including PIN management, authorised pickup adults, delegation codes and leader override policies.</li>
  <li>Keeping sign-in credentials confidential and reporting suspected compromise promptly.</li>
  <li>Complying with all laws applicable to the Customer's church, including data protection, safeguarding and charity law.</li>
</ul>

<h2>9. Data Protection and Security</h2>
<p>Customer data is stored in the United Kingdom (eu-west-2 region) to support UK data-residency expectations. Tenant isolation is enforced by row-level security policies at the database layer, and role-based access is enforced server-side. Data in transit is encrypted using industry-standard TLS.</p>
<p>Managed backups, patching and infrastructure security controls are provided by the underlying cloud platform. In the event that the Service Provider becomes aware of a personal-data breach affecting the Customer's tenant, it will notify the Customer's tenant administrator without undue delay and provide reasonable information to help the Customer meet its own notification obligations.</p>
<p>A current description of subprocessors and platform controls is maintained on the Trust page in the application.</p>
<p>This section is a statement of app-visible controls and platform capability; it is not a certification or independent audit.</p>

<h2>10. Data Retention, Export and Deletion</h2>
<p>The Customer's tenant administrator may archive or permanently delete tenant data at any time through the Danger Zone in Settings. Standard export capabilities (including CSV downloads and reports) are available within the application for supported modules.</p>
<p>On termination of this SLA, the Customer will have a period of <strong>30 days</strong> from the effective date of termination to export its data, after which the Service Provider may permanently delete the tenant and all associated records in the ordinary course of the deletion workflow.</p>

<h2>11. Third-Party Dependencies</h2>
<p>The Service integrates with third-party providers configured by the Customer, including but not limited to: SMS, WhatsApp and voice providers (e.g. Twilio); email delivery providers; payment processors (e.g. Stripe); and mapping/geocoding services. The availability, pricing, terms and data-handling practices of those providers are governed by the Customer's agreements with them. Outages or defects caused by such providers are outside the Uptime commitment in section 4.</p>

<h2>12. Confidentiality</h2>
<p>Each party will keep confidential all non-public information of the other party disclosed under or in connection with this SLA, and will use it solely to perform its obligations or exercise its rights under this SLA. This obligation continues for three years after termination. It does not apply to information that is public through no fault of the receiving party, was already known to the receiving party without confidentiality restriction, or is required to be disclosed by law.</p>

<h2>13. Fees and Billing</h2>
<p>Fees for the Service are set by the Customer's {{plan_name}} pricing plan as displayed in the tenant administration area. Usage-based overages (for example messaging above the plan allowance) are calculated monthly and, where applicable, billed via the Customer's configured payment method. Late or failed payment may result in suspension of the tenant in accordance with section 14.</p>

<h2>14. Term, Suspension and Termination</h2>
<p>This SLA continues on a rolling monthly basis and may be terminated by either party on 30 days' written notice. Either party may terminate immediately for material breach that is not remedied within 14 days of written notice.</p>
<p>The Service Provider may suspend the tenant for non-payment, for suspected abuse, for security reasons, or where required by law. The Customer's data-export right in section 10 applies on termination for any reason other than a serious breach involving unlawful use of the Service.</p>

<h2>15. Warranties and Limitation of Liability</h2>
<p>The Service is provided on an 'as is' and 'as available' basis. To the maximum extent permitted by law, the Service Provider disclaims all implied warranties, including merchantability, fitness for a particular purpose and non-infringement.</p>
<p>Neither party excludes or limits liability for death or personal injury caused by negligence, for fraud, or for any liability which cannot lawfully be limited. Subject to the foregoing, the Service Provider's total aggregate liability under or in connection with this SLA in any 12-month period is limited to the fees paid by the Customer to the Service Provider in the 12 months preceding the event giving rise to the claim. Neither party is liable for indirect, incidental, special or consequential loss, or for loss of profit, revenue, goodwill or data.</p>

<h2>16. Governing Law and Jurisdiction</h2>
<p>This SLA is governed by the laws of <strong>England and Wales</strong>. The parties submit to the exclusive jurisdiction of the courts of England and Wales for the resolution of any dispute arising under or in connection with it.</p>

<h2>17. Contact</h2>
<p>Members should contact their church's tenant administrator in the first instance. Tenant administrators may escalate unresolved issues to the ChurchConnect team at DomiFort Solutions Limited through the in-app feedback channel or the support email address published in the application.</p>

<h2>18. Signatures</h2>
<p><strong>For the Service Provider:</strong> DomiFort Solutions Limited (trading as ChurchConnect)</p>
<p><strong>For the Customer (Church / Tenant):</strong> {{tenant_name}}, by {{owner_name}} ({{owner_email}})</p>
<p>Countersignature is captured electronically via the in-app type-to-sign flow; the signed date, IP address and template version are recorded in the signature ledger.</p>

<p><em>End of Service Level Agreement — ChurchConnect v1.0</em></p>`;
