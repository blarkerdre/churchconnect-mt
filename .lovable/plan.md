# GDPR Compliance Audit — ChurchConnect

Produce a thorough, evidence-based GDPR compliance assessment of the app as it exists in this codebase (frontend, edge functions, database, storage, third-party integrations). Deliver a written report; **no code changes** in this pass.

## Scope of the audit

Assessed against UK GDPR + EU GDPR (Arts. 5, 6, 7, 9, 12–22, 25, 28, 30, 32, 33–34, 35, 44–49) and PECR where relevant (cookies, marketing comms).

Areas reviewed:

1. **Lawful basis & consent**
   - `useConsentText`, `ConsentPrivacySection`, public registration forms, first-timer capture, WoFBI form, testimony, feedback.
   - Consent granularity, withdrawal, records, age-of-consent (children's church).
2. **Special-category data (Art. 9)**
   - Religious affiliation, health/pastoral care notes, children's data, life-event requests.
3. **Data minimisation & purpose limitation**
   - `members` (44 cols), `first_timers`, `children`, `contacts`, pastoral care, call log, SMS log.
4. **Transparency (Arts. 12–14)**
   - Privacy policy link handling, notices on public forms, in-app disclosures.
5. **Data subject rights (Arts. 15–22)**
   - Access/export (`export-tenant-data` is tenant-wide, super-admin only — no per-member SAR flow).
   - Rectification, erasure, restriction, portability, objection, automated decision-making.
6. **Security of processing (Art. 32)**
   - RLS coverage, tenant isolation, storage RLS, edge function auth, service-role usage, recent fixes (billing_cron, pickup, roster notify, training attendees).
   - Encryption in transit/at rest, secrets handling, password policy (HIBP), MFA.
7. **Data residency & international transfers (Arts. 44–49)**
   - UK eu-west-2 claim vs. actual Supabase region; Stripe, Twilio, Resend/email provider, Lovable AI Gateway, push (FCM/APNs), Google OAuth — transfer mechanisms (SCCs/UK IDTA).
8. **Retention & deletion**
   - `purge-all-data` (30-day archive), `purged_data_archives`, audit_log retention, email/SMS logs, suppressed_emails, backups.
9. **Processors & sub-processors (Art. 28)**
   - Supabase, Lovable, Stripe, Twilio, email provider, push providers, DomiFort. DPA coverage + sub-processor list.
10. **Records of processing (Art. 30)** — is there a ROPA?
11. **DPIA (Art. 35)** — children's data + special category triggers.
12. **Breach response (Arts. 33–34)** — 72-hour notification process, contacts.
13. **Cookies / tracking (PECR)** — cookie banner, analytics, tracking pixels.
14. **Children's data**
    - `children`, `child_checkins`, `child_pickup_delegations`, `child_guardians`. Parental consent, minimum age.
15. **Marketing comms**
    - Announcements, birthday messages, bulk SMS/WhatsApp/email, unsubscribe (`handle-email-unsubscribe`, `email_unsubscribe_tokens`, `suppressed_emails`), SMS opt-out.
16. **Audit logging** — completeness and tamper resistance.
17. **Access control** — role model, tenant switching re-auth, super-admin powers.
18. **Public endpoints** — public registration, WoFBI, testimony, presentation — anti-abuse and data exposure.

## Method

- Read relevant edge functions, hooks, and RLS policies (batched).
- Query DB for: policies on sensitive tables (`members`, `children`, `pastoral_care`, `life_event_requests`, `child_*`, `call_log`, `sms_log`, `email_send_log`, `audit_log`), tables missing RLS, columns holding PII/special-category.
- Run supabase linter + review latest security scan (do **not** fix findings in this pass).
- Cross-check `supabase/config.toml` `verify_jwt=false` functions for data exposure.
- Inventory third-party data flows from `supabase/functions/*` and secrets.

## Deliverable

A single Markdown report saved to `/mnt/documents/ChurchConnect_GDPR_Compliance_Report.md` **and** a matching PDF at `/mnt/documents/ChurchConnect_GDPR_Compliance_Report.pdf`, containing:

- Executive summary + overall RAG rating
- Per-area findings with: requirement, evidence (file/table/policy), status (Compliant / Partial / Gap / Not assessable), severity (High/Med/Low), recommendation
- Prioritised remediation backlog (P1/P2/P3) with concrete actions and owners (app-owner vs. platform)
- Appendices: data inventory, processor list w/ transfer basis, retention matrix, RLS coverage summary, open items requiring user input (DPO, controller identity, DPA copies, ROPA, DPIA, cookie inventory)

## Out of scope

- No code, RLS, or config changes.
- Not legal advice — organisational/legal items (DPO appointment, ROPA authorship, DPIA sign-off, DPA execution) are flagged for the user's legal review.
- Does not cover physical/organisational controls outside the app (staff training, contracts, physical security).

## Assumptions (confirm or correct before I start)

1. Controller = each tenant church; Lovable/app-owner = processor. Correct?
2. Target jurisdictions: UK + EU only.
3. Report format: Markdown + PDF (same style as prior SLA — navy/gold cover, Playfair headings). OK?
4. I should include recommendations but **not** implement any fixes in this pass.
