# Detailed Audit Logging — Evidence-Grade Records

## Goal
Make `audit_log` an evidence-grade trail. Today only ~15 action types are logged (mostly role/member/event/announcement). Notifications, certificates, exports, imports, deletions, password resets, SMS/email sends, payments, etc. are not captured. We will close those gaps with consistent metadata and timestamps.

## What gets recorded

Every audit row will continue to use the existing schema (`audit_log`: `user_id`, `tenant_id`, `action`, `entity_type`, `entity_id`, `details jsonb`, `created_at`) — no destructive schema change. We standardise `details` to always include:

- `actor_email` / `actor_name` (snapshot at time of action)
- `target_name` / `target_email` where applicable
- `before` / `after` diff for updates (only changed fields)
- `channel` (sms|whatsapp|email|in_app|push) for messaging
- `recipients_count`, `success_count`, `failed_count`
- `source` (page or function name that produced the event)
- `ip` and `user_agent` for browser-originated actions (best-effort)
- `request_id` (uuid) so multi-step flows can be correlated

## New action coverage

### Notifications & messaging
- `notification_sent` — every direct in-app notification insert from admin tools
- `sms_sent` / `whatsapp_sent` — logged inside `send-sms` edge function after dispatch (per batch, with quota snapshot)
- `email_sent` — logged inside `send-email-alert` and `send-transactional-email`
- `birthday_messages_sent` — from `send-birthday-messages`
- `event_reminder_sent` — from `send-event-reminders`
- `bulk_message_sent` — already exists, will be standardised
- `announcement_publish` — when `is_published` flips true

### Certificates & training
- `certificate_issued` — from `issue-certificate` edge function (member, course, issued_by, certificate_url)
- `certificate_template_update` — from `CertificateTemplateSettings`
- `exam_session_open` / `exam_session_close`
- `exam_attempt_graded` — server-side grading trigger writes a row
- `course_registration_create` / `_cancel`

### Data actions (high-evidence)
- `data_export` — any tenant export (members CSV, training reports, attendance, etc.) via `export-tenant-data` and any client-side `Print/Download` flows
- `data_import` — `BulkImportDialog`, `import-tenant-data`
- `data_purge` / `data_restore` — `purge-all-data`, `restore-purged-data`
- `tenant_archive` / `tenant_restore`
- `member_create` / `member_update` / `member_delete` — full coverage with diffs (currently only delete is consistently logged)
- `member_status_change` — already tracked in `member_status_history`; mirror to `audit_log` for unified view
- `pastoral_assignment_create` / `_close`
- `transport_assignment`
- `followup_assignment` / `_status_change`
- `signpost_create` / `_update`
- `consent_update` (privacy/consent text changes)
- `settings_update` — any tenant settings change (sms limits, branding, providers)
- `secret_rotate` — API keys / Domifort tokens / tenant API keys
- `payment_recorded` / `subscription_change`

### Auth / access
- `login_success` / `login_failure` (from auth hook)
- `password_reset_request` / `password_reset_complete`
- `user_invite_send` / `user_invite_accept`
- `tenant_switch`

## Implementation plan

### 1. Shared audit helpers
- Extend `src/lib/audit.js`:
  - Auto-capture `user_agent` and best-effort `ip` (via lightweight IP echo edge fn `whoami`) and attach to `details.context`.
  - Add `logAuditDiff(action, entityType, entityId, before, after, tenantId)` that computes a minimal field diff.
  - Add `logAuditBulk(action, rows[], tenantId)` for batched writes.
- Create `supabase/functions/_shared/audit.ts` with:
  - `writeAudit(serviceClient, { tenant_id, user_id, action, entity_type, entity_id, details })`
  - `withAudit(handler, { action, entity_type })` wrapper for edge functions that auto-logs success/failure with timing.

### 2. Edge function instrumentation
Add `writeAudit` calls to:
- `send-sms`, `send-email-alert`, `send-transactional-email`, `send-birthday-messages`, `send-event-reminders`
- `issue-certificate`
- `export-tenant-data`, `import-tenant-data`, `purge-all-data`, `restore-purged-data`
- `archive-tenant`, `register-tenant`, `invite-to-tenant`
- `admin-create-user`, `admin-delete-user`, `admin-toggle-user`
- `create-tenant-api-key`, `domifort-token-create`
- `grade-exam`
- `stripe-subscription-webhook`, `manage-tenant-subscription`, `check-tenant-payments`

Each call records action, entity, and a `details` payload with channel/counts/before-after as relevant.

### 3. Database triggers (server-of-truth events)
New SQL triggers writing directly to `audit_log` for events that bypass the app:
- `members` insert/update/delete (diff-based)
- `notifications` insert (group by `(reference_type, reference_id, tenant_id)` to avoid one row per recipient — store `recipients_count`)
- `pastoral_care_cases`, `transport_bookings`, `followup_referrals`, `followup_referral_updates` status changes
- `tenant_invoices` paid/overdue transitions
- `tenants` settings/limit changes (compare OLD vs NEW jsonb)
- `member_status_history` → mirror into `audit_log` as `member_status_change`

All triggers `SECURITY DEFINER` with `SET search_path = public`, capture `auth.uid()` when present, fall back to `NULL` user_id with `details.source='system'`.

### 4. Client instrumentation
Add `logAudit` calls (or `logAuditDiff`) in:
- `MemberFormDialog` (create/update — currently missing)
- `CertificateTemplateSettings`, `IssueCertificateDialog`
- `BulkImportDialog`
- `DangerZoneSection` (purge/restore/export buttons)
- `Settings.jsx` sub-sections that mutate tenant settings (SMS limits, branding, providers, consent, banner, follow-up templates, external links, WSF zones/centres, birthday messages)
- `ApiKeysSection`, `DomifortIntegrationSection`
- `PastoralCareFormDialog`, `TransportBookingDialog`, `FollowupFormDialog`, `SignPostDialog`, `ReferralUpdateDialog`
- `TenantBillingTab` payment recording
- `MyProfile` password change
- `TenantContext` tenant switching

### 5. UI: Audit Log page upgrade (`src/pages/AuditLog.jsx`)
- Add filters: date range, actor, entity type, channel, tenant (for super admin).
- Add columns: timestamp (with seconds + timezone), actor, action, entity, channel, counts, source.
- Add expandable row showing full `details` JSON with diff highlighting (`before` vs `after`).
- Add "Export CSV" button for the current filtered view (logs the export itself).
- Pagination (50/page) and "Load more" instead of fixed 200.
- Add a "Notifications" and "Messaging" preset filter chip.
- Make accessible to tenant admins (currently super_admin only) — they see only their tenant's rows; super admin sees all.

### 6. Retention & integrity
- Add a partial index `idx_audit_log_tenant_created_at` for fast filtered queries.
- Document retention: keep indefinitely (evidence). Add a nightly job (no auto-delete) that asserts no row was modified — `audit_log` becomes append-only via a trigger that blocks `UPDATE`/`DELETE` for non-super-admins.

## Out of scope
- External SIEM streaming / webhook export
- Cryptographic chaining/Merkle proofs (can be a follow-up if compliance needs tamper-evidence beyond append-only)
- Backfilling historic events that were never logged

## Technical notes
- All triggers and edge writes go to the existing `audit_log` table — no schema migration to columns, only new indexes and a guard trigger.
- Notifications fan-out (one row per user) is collapsed into a single audit row keyed by `(reference_type, reference_id)` to keep the log readable.
- IP capture uses a tiny `whoami` edge function returning `req.headers.get('x-forwarded-for')`; cached per session in the client to avoid extra round-trips per action.
- Diff computation uses a shared `diffObjects(before, after, allowedKeys)` util to avoid logging sensitive/noisy fields (e.g. timestamps).

## Deliverables
1. Migration: append-only guard trigger + indexes + DB triggers for members/notifications/pastoral/transport/followups/tenants/invoices.
2. `supabase/functions/_shared/audit.ts` and instrumentation across the listed edge functions.
3. Extended `src/lib/audit.js` with diff + context capture + new `whoami` edge function.
4. Client instrumentation across the listed pages/dialogs.
5. Rebuilt `src/pages/AuditLog.jsx` with filters, diff view, CSV export, and tenant-admin access.
