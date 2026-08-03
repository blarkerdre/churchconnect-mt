# Downloadable CRM Platform Deck (.pptx)

Generate a polished, downloadable PowerPoint that presents this codebase as a **multi-tenant CRM platform** — no church-specific framing anywhere. All feature modules are re-described in generic CRM language (contacts, engagement, campaigns, service delivery, learning management, scheduling, analytics).

## Deliverable

A single `.pptx` in the documents area, downloadable from chat. Roughly 14-16 slides.

## Deck outline

1. Title — platform name, tagline, "Technical & Cloud Architecture Overview"
2. Executive summary — what the CRM does, who it serves
3. Core capability map — contacts/records, engagement, campaigns, scheduling, learning, analytics
4. Use cases — membership/contact lifecycle, attendance & check-in, task and case management, omnichannel outreach, training & certification, reporting
5. Multi-tenancy model — path-based tenant routing, per-tenant branding, data isolation
6. Technical architecture diagram — React/Vite SPA → managed Postgres + Auth + Storage + Edge Functions
7. Data layer & security — row-level security, role-based access, tenant-scoped queries, audit logging
8. Cloud deployment illustration — CDN edge, serverless functions, managed database, regional data residency
9. Integrations — email, SMS/voice/WhatsApp providers, payments, push notifications
10. Access control & roles — owner/admin/leader/member/read-only tiers
11. Automation — scheduled jobs, lifecycle triggers, notification pipelines
12. Reporting & exports — dashboards, CSV/PDF/DOCX generation
13. Mobile & PWA — installable app, offline shell, responsive UI
14. Compliance posture — data residency, consent, retention, deletion workflows
15. Roadmap / closing

## Terminology mapping (church → CRM)

- Members → Contacts / Records
- Church / tenant → Organisation / Workspace
- Attendance & check-in → Event attendance & on-site check-in
- Pastoral care → Case management
- Follow-ups → Engagement workflows
- Bible School / exams → Learning management & certification
- Home cells / units → Teams & groups
- Announcements → Campaigns & broadcasts

## Technical approach

- Build with `pptxgenjs` in a Node script (throwaway, run from `/tmp`).
- Two custom vector diagrams drawn with native pptx shapes (not images) so they stay crisp: a layered technical architecture diagram and a cloud deployment topology.
- Dark title/section slides with light content slides; one accent colour, consistent icon-in-circle motif, no text-only slides.
- Only capabilities that actually exist in this codebase are listed — no invented metrics, customer names, or figures.
- QA: validate the file, render every slide to an image, inspect each for overflow/overlap/contrast, fix and re-verify before delivering.

No application source files are changed by this task.
