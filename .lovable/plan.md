# Update Default SLA Content

Replace the placeholder `DEFAULT_SLA_BODY` in `src/lib/sla.js` with the full 18-section Service Level Agreement from the uploaded `ChurchConnect_SLA.docx`, adapted so the Service Provider is identified as **DomiFort Solutions Limited (trading as ChurchConnect)**.

## Changes

**`src/lib/sla.js`** — replace `DEFAULT_SLA_BODY` with the full SLA as HTML:
- Cover block: ChurchConnect (Church Management Suite), Service Level Agreement, Version 1.0, effective `{{effective_date}}`, governed by England & Wales.
- §1 Parties — name **DomiFort Solutions Limited (trading as "ChurchConnect")** as the Service Provider; `{{tenant_name}}` as the Customer/Tenant; owner `{{owner_name}}` (`{{owner_email}}`).
- §2 Definitions (Service, Tenant, Uptime, Downtime, Scheduled Maintenance, Support Hours, Incident, Severity, Personal Data).
- §3 Scope of Service — full module list; UK eu-west-2 hosting; financial accounting excluded.
- §4 Availability — 99.5% monthly target, measurement, exclusions.
- §5 Scheduled Maintenance — 48-hour notice, Sunday-morning avoidance.
- §6 Support — channels, P1/P2/P3 severity table (rendered as HTML `<table>`), Support Hours 09:00–17:30 UK Mon–Fri.
- §7 Remedies — no service credits; corrective action + termination right only.
- §8 Customer Responsibilities — config, users, content, third-party accounts, DSARs, safeguarding, credentials, law.
- §9 Data Protection & Security — UK residency, RLS, TLS, breach notification, Trust page reference.
- §10 Retention, Export & Deletion — Danger Zone, 30-day post-termination export window.
- §11 Third-Party Dependencies — Twilio, email, Stripe, mapping.
- §12 Confidentiality — 3-year survival.
- §13 Fees & Billing — `{{plan_name}}` plan, usage overages.
- §14 Term/Suspension/Termination — rolling monthly, 30-day notice, 14-day cure.
- §15 Warranties & Limitation of Liability — as-is, 12-month fee cap.
- §16 Governing Law — England & Wales, exclusive jurisdiction.
- §17 Contact — tenant admin first; escalate via in-app feedback.
- §18 Signature block — Service Provider (DomiFort Solutions Limited) pre-filled; Customer side auto-populated from `{{owner_name}}` / `{{tenant_name}}` at merge time; countersignature captured via the existing type-to-sign flow.

Existing merge tokens (`{{tenant_name}}`, `{{owner_name}}`, `{{owner_email}}`, `{{effective_date}}`, `{{plan_name}}`, `{{app_name}}`, `{{tenant_slug}}`) are woven into §1, §3, §13 and §18 so tenant-specific details auto-fill on preview, download and signing.

## Not changing
- No schema or edge-function changes; existing `sla_templates` / `tenant_sla_signatures` tables and `SLASection` / `SLATemplateAdmin` UI are unchanged.
- The seeded DB template row remains as-is; Super Admins can click **Publish new version** in Tenant Admin → SLA to promote this new default to tenants. (If you'd prefer I also push a new v2 row via migration on approval, say the word.)

## Technical notes
- Content stored as HTML string with `<h1>`/`<h2>`/`<p>`/`<ul>`/`<table>` — already supported by the TipTap-style preview (`dangerouslySetInnerHTML`) and by `htmlToBlocks()` in the jsPDF generator (headings, paragraphs and list items are parsed; table rows degrade to plain-text lines in the PDF, which is acceptable for the P1/P2/P3 grid).
- No new dependencies.
