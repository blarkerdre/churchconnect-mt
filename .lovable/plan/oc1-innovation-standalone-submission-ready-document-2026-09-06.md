# OC1 (Innovation) — standalone submission-ready document

A single, self-contained Word document evidencing **Optional Criterion 1: Innovation** only, ready to attach to your Tech Nation Global Talent application. Every supporting GitHub image will show your full name, **Adeniyi Olusegun Kugbiyi**, as owner and author.

Your repository is public and your GitHub profile name is set, so the captures can be taken now.

## What the document contains

**Cover page** — title, your full name as founder and lead architect, the live product address, date, and a one-line innovation claim.

**Section 1 — Applicant and product**
Who you are, what the platform is, the sector it serves, and the scale it runs at (churches served, member records, registered accounts, modules, database objects, deployed backend functions, lines of code). Every figure queried live, none estimated.

**Section 2 — Statement of innovation**
A short assessor-facing summary: what is genuinely new here versus what the sector currently uses.

**Section 3 — The four innovations**
Each written as: the problem in the sector → what you built → why it is novel → the evidence.
1. Database-enforced multi-tenancy — a null-safe access oracle enforced in the database itself, with per-church theming, branding, feature toggles and quotas.
2. Digital child safeguarding — PIN-verified drop-off and pickup, authorised-adult registers, time-boxed delegation codes, leader override, tamper-evident trail.
3. Privacy-preserving analytics — visitor measurement with no address ever stored, rotating anonymous identifiers, no cookie-consent burden; backed by 90 days of live production traffic.
4. Self-healing production recovery — a cooled-down reload guard that prevents users being trapped in a broken deployment.

Each gets a captioned GitHub figure showing the repository name, file path and line numbers.

**Section 4 — Live traction evidence**
The 90-day analytics (visitors, page views, pages per visit, average visit duration, bounce rate) presented as proof the innovations are in real use, not prototypes.

**Section 5 — Ownership and authorship**
Your ownership statement, plus GitHub evidence: the repository page showing you as sole contributor, and your profile page showing your full name and commit volume against this repository.

**Appendix — Assessor traceability index**
Table mapping each claim to its repository file path and line range so an assessor can verify it directly.

## Images

Five to six captures taken fresh from your live public repository at desktop size:
- Repository landing page — owner, name, commit count, language mix.
- Your profile page — full name "Adeniyi Olusegun Kugbiyi" with activity on this repository.
- One code capture per innovation — file path, repository name and line numbers visible.

Where GitHub truncates your surname in a narrow panel, I capture at a wider window so the full name renders; if GitHub still truncates it, I use the profile capture for the name and say so plainly rather than editing anything. No image is altered beyond cropping and blurring personal data.

## Technical notes

- Metrics queried read-only from the production database and the analytics tables; code counts taken from the repository.
- Captures via headless Playwright against github.com at desktop viewport, wide enough to render your full name.
- Document built with the `docx` library: Arial, A4, heading styles, DXA-width tables, full-width captioned figures.
- Every page rendered to an image and inspected for clipping, overflow, broken images or blank pages before delivery.
- Delivered as `Global-Talent-OC1-Innovation.docx`. The existing evidence documents stay untouched.
- No application code changes.
