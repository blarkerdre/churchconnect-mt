# Tech Nation Global Talent — Evidence Pack (Exceptional Talent)

Structure the app's technical innovations against the Tech Nation Digital Technology criteria, delivered as both a chat summary and a downloadable Word document.

## Note on criteria selection

Tech Nation requires the Mandatory Criterion plus **exactly two** Optional Criteria. You selected all four, so the pack will cover all four with a clear recommendation of the strongest two to submit (likely OC1 Innovation and OC3 Significant Technical Contributions, since the evidence is architectural and product-led). The other two are included as reserve material in an appendix.

## Document structure

**Section 0 — Applicant summary**
One-page framing: platform scale (multi-tenant SaaS, live at churchmanagementsuite.org), your role, and the headline claim.

**Mandatory Criterion — Recognised leader / proven track record**
- Sole architect of a production multi-tenant SaaS serving multiple churches
- Live traffic evidence from the in-app analytics (4,394 visitors / 21,500 page views over 3 months)
- Breadth of delivery: 40+ functional modules shipped end-to-end

**OC1 — Innovation (product-led digital technology)**
- Path-based multi-tenancy with runtime tenant theming and branding
- Children's Church safeguarding: PIN-based drop-off/pickup, authorised adults, delegation codes, leader override
- Bible School lifecycle: editions, exams, server-side grading triggers, automated certificate issue/send
- Multi-provider communications abstraction (SMS/voice/email/WhatsApp) with per-tenant provider overrides and quotas

**OC2 — Recognition beyond the immediate occupation**
- Free/at-cost platform contributed to faith community infrastructure
- GDPR/DSR tooling (erasure requests, consent events, data portability) as a public-good pattern
- Placeholder prompts for: talks, mentoring, open-source, community adoption — you supply specifics

**OC3 — Significant technical contributions**
- Defence-in-depth tenant isolation: routing + context guards + RLS + `SECURITY DEFINER` role functions
- Separate `user_roles` table with `has_role()` to prevent privilege escalation
- Privacy-preserving first-party analytics: no IP stored, rotating anonymous visitor IDs, DNT respected, edge-function ingest with rate limiting
- Production resilience engineering: time-boxed chunk-reload guard preventing reload loops, self-healing lazy imports
- Enforced TOTP 2FA gated on the server-issued assurance level (AAL), not a client flag
- Full audit trail via a generic `audit_row_change()` trigger across 83 tables
- Edge-function fleet (Deno) for registration, invitations, certificates, erasure, email queue

**OC4 — Commercial / economic impact**
- Stripe recurring subscription billing with webhook lifecycle handling
- Tenant onboarding wizard enabling self-serve church acquisition
- Storage and member quota enforcement as the monetisation lever
- Measured usage figures from the analytics module
- Placeholder prompts for: revenue, tenant count, cost savings vs incumbents — you supply specifics

**Appendix A — Technical citations**
File and table references (e.g. `src/contexts/TenantContext.jsx`, `analytics_page_views`, `supabase/functions/track-pageview`) so an assessor can trace each claim.

**Appendix B — Evidence-gathering checklist**
What to attach alongside: letters of recommendation, screenshots, usage exports, domain/DNS proof, repository history.

## Technical approach

- Gather citations by reading the relevant source files and querying the database for real figures (tenant count, member count, module counts) so no number in the pack is invented.
- Generate `Global-Talent-Evidence-Pack.docx` with the `docx` library: Arial base, Heading 1/2 styles, a table of contents, and criteria tables (DXA widths).
- Output to `/mnt/documents/` and attach it in chat, plus a condensed version of the same structure written out in the chat reply.
- No changes to the application source code.
