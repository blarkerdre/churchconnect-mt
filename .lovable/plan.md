# GDPR Compliance Implementation Plan

Scope: implement everything actionable in code (P1 fixes + consent/transparency + data subject rights UI). Legal artefacts (DPIA, ROPA, DPA, sub-processor register) remain the tenant's responsibility.

---

## 1. Data Subject Rights (DSR) Portal — `/my-data`

New member-facing page (linked from profile menu) with four tabs:

- **Access / Export** — button calls new `export-member-data` edge function. Returns JSON bundle of every table row where `user_id = auth.uid()` or `member_id` matches, plus signed URLs for uploaded documents/photos. Rate-limited to 1/day.
- **Rectify** — deep link into existing profile edit form; adds a "correction requested" note when non-editable fields (e.g. legal name on financial receipts) are flagged.
- **Erasure request** — opens `erasure_requests` queue (see §2).
- **Withdraw consent** — toggles for each granular consent flag stored on `members` (see §3).

## 2. Admin-approved erasure queue

New table `erasure_requests`:
- `id, tenant_id, member_id, user_id, reason, status (pending|approved|rejected|completed), requested_at, reviewed_by, reviewed_at, review_note, completed_at`
- RLS: member sees own; tenant admin/pastor sees tenant scope; service_role full.

Flow:
1. Member submits from `/my-data`.
2. Notification to tenant admins (in-app + email via existing queue).
3. Admin reviews in **Settings → Data Requests**. Approve → runs `process-erasure` edge function which:
   - Anonymises `members` row (name → "Erased Member", strips email/phone/dob/address/notes/photo).
   - Nulls `user_id` FKs on shared history (attendance, followups, pastoral_care) — retains statistical rows.
   - Deletes personal artefacts (sermon_notes, testimonies, feedback, push_subscriptions).
   - Snapshots to `purged_data_archives` with `scope='member'`, 30-day recovery.
   - Deletes `auth.users` row if member has no other tenant memberships.
   - Writes audit_log entry.
4. Reject → status recorded, member notified with reason.

Legal-hold override: admin can mark request "retain-under-legal-obligation" with mandatory note.

## 3. Granular consent + consent audit trail

Add to `members`:
- `consent_privacy_accepted_at` (existing consent capture, keep)
- `consent_marketing` (bool, default false)
- `consent_photos` (bool, default false)
- `consent_pastoral_contact` (bool, default true)
- `consent_third_party_sharing` (bool, default false)

New table `consent_events` (append-only audit): `id, tenant_id, member_id, consent_type, granted, source (registration|profile|dsr_portal|admin), ip_hash, user_agent, occurred_at`. Populated by trigger on `members` update.

Registration forms, first-timer form, WoFBI form and profile page get individual toggles instead of a single blanket consent. Bulk comms filters honour `consent_marketing`; photo galleries/announcement uploads filter by `consent_photos`.

**Parental consent for children**: `children` gets `parent_consent_given_by`, `parent_consent_at`, `parent_consent_ip_hash`. Child check-in creation requires a guardian on `child_guardians` to have granted consent — enforced by trigger.

## 4. Full cookie/PECR consent manager

New `<CookieConsentBanner />` mounted in `App.jsx`:
- Three categories: **Necessary** (auth, tenant) always on; **Functional** (tour completions, preferences); **Analytics** (any future pixel).
- Preferences persisted in `localStorage` (`cc_consent_v1`) + logged to `consent_events` when user is authenticated.
- "Manage cookies" link in footer + Trust page to re-open at any time.
- Existing non-essential storage (tour completion, install prompt dismissals) gated on Functional consent.

## 5. Retention automation

New table `retention_policies` (tenant-scoped, defaults seeded):
- `first_timers` → 2 years since `created_at` if not converted
- `pastoral_care` closed cases → 6 years
- `call_log`, `sms_log`, `email_send_log` → 2 years
- `notifications` (read) → 90 days
- `audit_log` → 6 years
- `purged_data_archives` → 30 days (already handled)

New cron edge function `enforce-retention` runs daily, deletes rows past policy, writes audit summary. Admin UI at **Settings → Retention** to view/adjust (bounded to legal minima).

## 6. MFA prompt (soft nudge for all roles)

- Enable TOTP factor via Supabase auth (already supported).
- New `MFASetupDialog` shown once per session for users without a verified factor.
- "Remind me later" dismissal stored on `profiles.mfa_prompt_snoozed_until` (7-day snooze).
- Settings → Security section for enrol / remove / regenerate recovery codes.
- No hard block — matches chosen policy.

## 7. Rate limiting on public endpoints

Ad-hoc token-bucket in Postgres (`public_endpoint_rate_limits` table: `ip_hash, endpoint, window_start, count`). Applied to: `send-testimony`, `PublicRegistration`, `PublicWoFBIRegistration`, `handle-email-unsubscribe`, `export-member-data`. Configurable per endpoint; default 10/hour per IP.

(Noted: the platform has no standard rate-limit primitive; this is an ad-hoc implementation accepted as a tradeoff for GDPR/abuse posture.)

## 8. Transparency: in-app Privacy Notice

New `/privacy` route rendering a structured, tenant-branded notice pulling from:
- `app_settings.privacy_policy_url` (existing external link — kept)
- Plus in-app sections: what data is collected, purposes, lawful bases, retention periods (from §5), recipients (Stripe/Twilio/Resend/Lovable Cloud), data subject rights (link to `/my-data`), DPO contact (new `app_settings.dpo_contact`).

Footer + registration/first-timer/WoFBI forms link here alongside the external policy.

## 9. Admin: Data Requests dashboard

New page **Settings → Data Requests** (admin only):
- Tabs: Erasure requests, Export requests log, Rectification notes.
- KPIs: open count, avg response time, overdue (>30 days) badge.

---

## Technical notes

**New tables** (all with tenant_id, RLS, GRANTs, timestamps + update trigger):
- `erasure_requests`, `consent_events`, `retention_policies`, `public_endpoint_rate_limits`

**New edge functions**:
- `export-member-data` (auth required, rate-limited, returns member-scoped JSON + signed URLs)
- `process-erasure` (admin auth + tenant scope check, anonymises + archives)
- `enforce-retention` (cron, service-role, per-tenant policy walk)

**Modified tables** (via migration):
- `members` — add consent columns
- `children` — add parental consent columns
- `profiles` — add `mfa_prompt_snoozed_until`

**Modified components**:
- `App.jsx` — mount CookieConsentBanner, MFASetupDialog
- `MemberFormDialog`, `PublicRegistration`, `PublicWoFBIRegistration`, `WelcomeQuestions`, `TestimonyFormDialog` — swap blanket consent → granular toggles
- `BulkMembersPanel`, `DirectSendPanel`, `AnnouncementForm` — filter recipients by `consent_marketing`
- `ChildFormDialog` — add parental consent capture
- `AppLayout` footer — add /privacy + Manage cookies links
- Profile page — add "My Data" entry

**Not in scope** (user's responsibility):
- Drafting the actual privacy policy copy (I'll scaffold placeholder text you must review with counsel)
- Signing DPAs with Stripe/Twilio/Resend/Lovable
- Publishing ROPA/DPIA documents
- Confirming UK data residency claims with each sub-processor

## Delivery order

1. Migration: new tables, columns, RLS, GRANTs, triggers
2. Edge functions: export-member-data, process-erasure, enforce-retention
3. `/my-data` portal + `/privacy` page
4. Admin Data Requests page + Retention settings
5. Granular consent toggles across forms + audit trigger
6. Cookie banner + MFA nudge
7. Rate limits on public endpoints
8. Update security memory noting the accepted ad-hoc rate-limit approach and DSR flow

Approve to proceed and I'll implement in that order.