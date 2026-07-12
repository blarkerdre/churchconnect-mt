
## Plan: ChurchConnect Service Level Agreement (DOCX + PDF)

Produce a professional, self-contained SLA document for ChurchConnect and save both formats to `/mnt/documents/` for download. No app/code changes.

### Deliverables
- `/mnt/documents/ChurchConnect_SLA.docx`
- `/mnt/documents/ChurchConnect_SLA.pdf`

### Document sections
1. **Parties & effective date** — ChurchConnect (Service Provider) and the Church/Tenant (Customer); placeholder fields for name, effective date.
2. **Definitions** — Service, Tenant, Uptime, Downtime, Scheduled Maintenance, Support Hours, Incident, Severity, Personal Data.
3. **Scope of Service** — Multi-tenant church management platform (members, attendance, communications, follow-ups, pastoral care, events, children church, transport, exams/Bible School, home cells, tenant admin). Hosted on Lovable Cloud, UK data residency (eu-west-2).
4. **Service availability** — Target **99.5% monthly uptime** (≈3.6 hours max downtime/month). Measurement window, exclusions (scheduled maintenance, force majeure, customer-caused, third-party providers such as SMS/Email/WhatsApp/Voice, tenant misconfiguration).
5. **Scheduled maintenance** — Notice period (≥48h for standard, best-effort for emergency), typical off-peak windows, excluded from uptime calc.
6. **Support** — Channels (in-app, email to tenant admin → dev team). **Standard response SLAs**:
   - **P1 (Critical / service unavailable):** 4 business hours response
   - **P2 (Major / significant impairment):** 1 business day
   - **P3 (Minor / cosmetic / question):** 3 business days
   - Support hours: UK business hours, Mon–Fri, excluding UK public holidays. Response ≠ resolution.
7. **No service credits** — Explicitly states remedies are limited to corrective action and support; no financial credits are offered.
8. **Customer responsibilities** — Accurate configuration, user provisioning, role assignments, message content compliance, third-party provider accounts (Twilio, Resend, Stripe, etc.), data-subject request handling, safeguarding oversight for Children Church, keeping credentials private.
9. **Data protection & security** — UK data residency, RLS tenant isolation, role-based access, encryption in transit, backups managed by the underlying platform, breach notification process, subprocessor list references the Trust page.
10. **Data retention, export & deletion** — Tenant admins can archive/delete via Danger Zone; export options; deletion workflow.
11. **Third-party dependencies** — Communications (SMS, WhatsApp, Voice, Email), Payments (Stripe), Maps/geocoding. Outages of third parties fall outside uptime commitments.
12. **Confidentiality** — Mutual, standard clauses.
13. **Fees & billing** — Reference to the Customer's pricing plan; overage handling; suspension for non-payment.
14. **Term, suspension & termination** — Monthly rolling, termination for cause, data export window after termination.
15. **Limitation of liability & disclaimer** — Service provided "as is"; liability capped at fees paid in prior 12 months; excludes indirect/consequential loss.
16. **Governing law** — England & Wales, exclusive jurisdiction.
17. **Contact** — Church administrator first line; escalation to ChurchConnect team.
18. **Signature block** — Provider + Customer.

### Style
- Cover page with ChurchConnect wordmark text, navy (#0C2340-ish) heading color, gold accent rule, Playfair-style serif for headings (Georgia fallback in DOCX), sans body.
- Numbered sections, clear hierarchy, footer with page numbers and "ChurchConnect SLA — v1.0".
- "Last updated" date auto-set to today.

### Technical approach
- Generate DOCX with `docx` (Node) following the DOCX skill: US Letter / A4 page, proper style overrides for Heading1/2, dual widths on any tables, DXA units, smart quotes.
- Generate PDF with ReportLab Platypus (matching layout/typography) — do not convert the DOCX, to avoid LibreOffice quirks and keep exact styling.
- QA both: render DOCX → PDF images and inspect each page; render PDF → images and inspect each page; fix overflow/clipping/font issues before delivering.
- Emit `<presentation-artifact>` tags for both files.

### Out of scope
- No changes to app routes, pages, or code.
- No `/sla` in-app page (user chose standalone document only).
- Not a legally reviewed contract — document will include a plain-English disclaimer that it is a template and should be reviewed by the church's own legal counsel before signature.
