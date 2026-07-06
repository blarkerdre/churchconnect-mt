## Deliverable

A ~10–12 page conference-style research paper positioning the Church Management Suite as a **general-purpose multi-tenant membership, engagement, and lifecycle platform**, with a broad survey of how its architecture and modules transfer across sectors (non-profits/NGOs, education/training, community clubs & associations, and other faith organisations). Produced in three formats and saved to `/mnt/documents/`:

- `research-paper-universal-application.md`
- `research-paper-universal-application.docx`
- `research-paper-universal-application.pdf`

## Paper structure (IEEE/ACM-style, ~10–12 pages, 2-column PDF)

1. **Title, authors, affiliation, abstract, keywords**
   Working title: *"A Multi-Tenant Membership Lifecycle Platform: Generalising a Church Management System for Cross-Sector Adoption"*
2. **Introduction** — problem statement, motivation for domain-agnostic membership platforms, contribution summary.
3. **Related Work** — membership CRMs (Salesforce NPSP, Planning Center, Breeze), multi-tenant SaaS (Kong, Chen et al.), LMS/attendance systems (Moodle), pastoral-care/case-management analogues. All cited.
4. **System Architecture** — path-based multi-tenancy (`/t/:tenantSlug`), Postgres + RLS isolation, tenant-scoped role bridging, edge functions, UK data residency, dynamic theming, PWA. Diagrams described in text + one architecture figure.
5. **Domain Model & Modules** — abstract the vocabulary (Member, Unit, Home Cell, Follow-up, Event, Course, Attendance, Communications, Reports, Training Certificates, Storage/Quota) and show its 1-to-1 mapping to generic membership primitives.
6. **Universal Application: Cross-Sector Survey**
   - 6.1 Non-profits & NGOs (volunteers, donors, beneficiaries, case follow-up)
   - 6.2 Education & training centres (students, cohorts, attendance, exams, certificates)
   - 6.3 Community clubs & professional associations (chapters, committees, events, dues-free membership)
   - 6.4 Other faith organisations (mosques, temples, synagogues — terminology remap only)
   For each: mapping table (Church term → sector term), which modules apply as-is, which need only relabelling, which need extension.
7. **Configurability & Adaptation Mechanisms** — DB-driven feature toggles, tenant branding, terminology mapping (WoFBI→Bible School, WSF→Home Cell), management toggles, external links, per-tenant comms providers.
8. **Security, Privacy & Compliance** — RLS, tenant_id guards, GDPR/UK residency, consent capture, XSS hardening, role-based access, audit logs, storage quotas.
9. **Evaluation** — qualitative rubric across sectors: fit score per module (as-is / relabel / extend / not applicable), summarised in one large table; discussion of gaps (financial tracking explicitly out of scope, dues/donations, sector-specific compliance like FERPA/HIPAA analogues).
10. **Discussion & Limitations** — single-database tenancy trade-offs, terminology drift, need for sector-specific onboarding wizards.
11. **Conclusion & Future Work** — pluggable terminology packs, sector templates on tenant creation, marketplace of modules.
12. **References** — ~18–25 academic + industry citations (ACM/IEEE format), covering multi-tenant SaaS, RLS, membership CRM, LMS, GDPR, PWA.

Two figures + three tables:
- Fig. 1: System architecture (tenant router → RLS → modules).
- Fig. 2: Cross-sector mapping diagram.
- Table I: Vocabulary mapping (Church ↔ NGO ↔ Education ↔ Club ↔ Faith).
- Table II: Module fit matrix (rows = 15 modules, columns = 4 sectors, cell = as-is / relabel / extend / N/A).
- Table III: Compliance & data-residency features vs sector requirements.

## Technical approach

- Author paper content directly (no live app changes). All source citations are real, publicly verifiable references (multi-tenant SaaS papers, GDPR regulation, PostgreSQL RLS docs, Planning Center / Breeze / Salesforce NPSP public materials, Moodle papers, PWA W3C specs).
- Generate Markdown master file first (source of truth).
- Generate DOCX with the `docx` npm library per the skill/docx guidance: US Letter, Arial fallback with Times-like serif for body, proper `HeadingLevel` styles, real tables (DXA widths), image figures rendered via matplotlib to PNG then embedded, footnotes for citations, page numbers in footer.
- Generate PDF via `pandoc` from the Markdown with a two-column LaTeX template (or via LibreOffice from the DOCX if pandoc/LaTeX is unavailable) for the conference look.
- QA pass: convert DOCX and PDF to per-page images with LibreOffice + pdftoppm, `code--view` each page, fix layout/clipping, re-emit. Only then present the artefacts.

## What the paper does NOT do

- No code changes to the app.
- No modification of DB, RLS, edge functions, or landing page.
- No claim of empirical user studies — evaluation is qualitative/architectural.
- No sector-specific implementation work; only analysis and recommendations.

## Files written

- `/mnt/documents/research-paper-universal-application.md`
- `/mnt/documents/research-paper-universal-application.docx`
- `/mnt/documents/research-paper-universal-application.pdf`
- One architecture figure and one mapping figure under `/mnt/documents/figures/` (referenced by the paper).

Presented back to you with three `<presentation-artifact>` tags for direct download.
