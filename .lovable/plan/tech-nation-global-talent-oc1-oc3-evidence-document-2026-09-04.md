# Tech Nation Global Talent — OC1 & OC3 Evidence Document

A submission-ready Word document evidencing **Optional Criterion 1 (Innovation)** and **Optional Criterion 3 (Significant Technical Contributions)** for the Exceptional Talent route, authored to establish you as the owner, architect and principal contributor of the Church Management Suite platform.

No application source code is changed. All Lovable references are stripped from the document, the code excerpts and the screenshots.

## What the document contains

**Cover and applicant statement**
Title page naming you as founder, owner and lead architect of the platform, with the live product URL, the technology base described in neutral terms (React, TypeScript/JavaScript, PostgreSQL, serverless edge functions), and a one-paragraph headline claim.

**Section 1 — Platform overview and scale**
Verified metrics pulled live from the production database and the in-app analytics, presented as a metrics table. Every figure is queried, not estimated:
- Tenant (church) count, member records, registered users
- Functional module count and route count
- Database tables, RLS policies, SECURITY DEFINER functions, audit-covered tables
- Edge functions deployed, migrations applied
- Lines of application code
- Traffic: visitors, page views, views per visit, visit duration, bounce rate (3-month window)

**Section 2 — OC1: Innovation**
Four evidenced innovations, each written as: the problem in the sector, what was built, why it is novel, and the code/database evidence.
1. Runtime multi-tenant SaaS for a sector served almost entirely by single-organisation software — path-based tenancy, per-tenant theming, branding, feature toggles and quotas.
2. Digital child-safeguarding: PIN-verified drop-off/pickup, authorised-adult registers, time-boxed delegation codes and leader override, with a tamper-evident trail.
3. Automated education lifecycle: course editions, exams with server-side grading triggers, ranking, and bulk certificate issue-then-send.
4. Multi-provider communications abstraction with per-tenant provider overrides, monthly quotas and a dead-letter-queue-backed delivery pipeline.

**Section 3 — OC3: Significant Technical Contributions**
Six contributions, each with an annotated code excerpt (file name and line numbers) and an explanation of the engineering judgement involved.
1. Defence-in-depth tenant isolation — routing guard, context guard, RLS predicate, `SECURITY DEFINER` role function.
2. Privilege-escalation-resistant authorisation — roles in a dedicated table with `has_role()` rather than a column on the user record.
3. Server-enforced two-factor authentication gated on the token assurance level (AAL), not a client-side flag.
4. Privacy-preserving first-party analytics — no IP retention, rotating anonymous identifiers, DNT respected, preflight-free beacon, rate-limited edge ingest.
5. Universal audit trail via a single generic trigger function across 83 tables, with redaction of secrets and diff suppression.
6. Production resilience — time-boxed chunk-reload guard that prevents infinite reload loops on a broken deploy, plus self-healing lazy imports.

**Section 4 — Visual evidence**
Captioned, full-width screenshots grouped by theme:
- Core admin: Dashboard, Members directory, Tenant Admin
- Security and audit: System Logs audit trail, two-factor setup, roles and permissions
- Analytics and safeguarding: Usage analytics panel, Children's Church check-in
- Bible School and communications: course results/certificates, communications with quotas

**Section 5 — Attribution and contribution record**
Explicit ownership statement: sole architect and principal contributor, covering the database schema, security model, serverless backend, frontend and deployment. Backed by repository/migration history counts.

**Appendix — Assessor traceability index**
Table mapping every claim to its file path, line range or database object.

## Technical approach

- Query the production database read-only for real counts; count code, routes, functions and migrations from the repository. No number is written that has not been measured.
- Capture screenshots with headless Playwright against the running app at desktop viewport, signed in with an appropriate account; each capture is reviewed before inclusion and any Lovable badge or preview-host chrome is cropped or excluded.
- Generate the document with the `docx` library: Arial base, A4, heading styles, a table of contents, DXA-width tables, monospace code blocks with line numbers, and captioned images.
- Convert every page to an image and inspect each one for clipping, overflow, broken images or blank pages before delivering; regenerate until clean.
- Deliver as `Global-Talent-OC1-OC3-Evidence.docx` in the documents area, attached in chat.
