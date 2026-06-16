# Admin Direct Messaging

Add an admin-only **Direct Send** tab in Communications that supports individual sends to anyone (member, first-timer, contact, or free-form recipient) and bulk sends to non-member contact pools, across Email / SMS / WhatsApp / In-App.

## 1. Database — new `contacts` table

A tenant-scoped, admin-managed pool of non-member contacts (separate from `first_timers`). Migration includes:

- Columns: `id`, `tenant_id`, `first_name`, `last_name`, `email`, `phone`, `tags text[]`, `notes`, `source` (`manual` | `csv`), `created_by`, `created_at`, `updated_at`.
- Index on `(tenant_id)`; partial unique on `(tenant_id, lower(email))` where email is not null.
- GRANTs to `authenticated` + `service_role`; RLS so only admins/super-admins of the tenant can SELECT/INSERT/UPDATE/DELETE (via `has_role` + `user_has_tenant_access`).
- No anon access.

## 2. Contacts management UI

Under the new tab, a "Manage Contacts" subsection (admin-only):
- List with search by name/email/phone and tag filter.
- Add / edit / delete contact dialog (zod-validated).
- CSV import (client-side parse, preview, bulk insert with `tenant_id`).
- Tag chips for grouping (e.g. "Outreach 2026", "Christmas Card list").

## 3. New tab: "Direct Send" (admin-only)

Added to `src/pages/Communications.jsx` after Announcements. Gated on `canManageComms`. Two modes via inner tabs:

### Mode A — Individual
- Recipient picker (combobox) searches across members, first-timers, and contacts; shows type badge.
- "Custom recipient" toggle: free-form name + email + phone fields (zod-validated; at least one channel-appropriate field required).
- Channel selector: Email / SMS / WhatsApp / In-App. In-App is disabled when the recipient is not a member (no account to notify).
- Subject (email only) + message body.
- Send button → dispatches to the matching backend path (see §4).

### Mode B — Bulk to non-member contacts
- Source: First Timers, Contacts, or Both.
- Filters: tag (contacts), status/date range (first-timers), free-text search.
- Selected-count badge + preview list with invalid recipients separated (reuses `InvalidRecipientsPreview`).
- Channel: Email / SMS / WhatsApp (In-App hidden — non-members have no account).
- Schedule-for-later toggle (reuses `scheduled_communications` pattern).

## 4. Send wiring

- **Email** — call `send-transactional-email` with a new generic `admin-direct-message` template (subject + body props). Each recipient invoked individually with an idempotency key `direct-${uuid}-${email}`.
- **SMS / WhatsApp** — reuse `send-sms` edge function by passing `directRecipients` (existing param shape `{ phone, member_id? }`). For non-members, `member_id` omitted; `sms_log` row written with `recipient_name`/`recipient_phone` and `recipient_member_id = null` (already supported — verify column nullability in migration if needed).
- **In-App** — insert into `notifications` table with `user_id` resolved from the selected member; only available when recipient is a member.
- **Bulk schedule** — insert into `scheduled_communications` with a new `audience_source` field (`contacts` | `first_timers` | `both`) + filter payload; `process-scheduled-communications` edge function extended to resolve recipients from the chosen source.

## 5. Permissions & audit

- Tab + all send actions gated on `isAdmin || isSuperAdmin` (already exposed via `canManageComms`).
- Every send writes a `logAudit` entry: action `direct_message_sent`, payload `{ channel, recipient_count, mode }`.
- Quota pre-check reused from `SMSDialog` for SMS/WhatsApp.

## 6. Files

**New**
- `supabase/migrations/<ts>_contacts_table.sql` — table, grants, RLS.
- `supabase/migrations/<ts>_scheduled_audience_source.sql` — add `audience_source` column.
- `src/pages/Contacts.jsx` or panel inside Communications for CRUD + CSV import.
- `src/components/comms/DirectSendPanel.jsx` — the new tab content (individual + bulk modes).
- `src/components/comms/RecipientPicker.jsx` — unified search across members / first-timers / contacts + custom recipient toggle.
- `supabase/functions/_shared/transactional-email-templates/admin-direct-message.tsx` + registry entry.

**Edited**
- `src/pages/Communications.jsx` — register the new tab.
- `supabase/functions/send-sms/index.ts` — accept non-member direct recipients (verify already does; tighten if not).
- `supabase/functions/process-scheduled-communications/index.ts` — handle `audience_source`.

## 7. Out of scope

- Marketing/newsletter blasts to members (use existing audience tools).
- Two-way conversations / inbox for non-members.
- File attachments (email API limitation).
