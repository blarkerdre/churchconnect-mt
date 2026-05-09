## Goal
Send tenant-branded "Happy Birthday" messages to members on their birthday across **In‑app, Email, SMS and WhatsApp**, with editable templates, a master on/off switch, per‑channel toggles, and a manual "Send now" button. Auto-send runs daily at the tenant's configured local time; skips already-sent recipients via idempotency.

## Data model

### 1. New table: `birthday_message_settings` (one row per tenant)
- `tenant_id` (PK, FK → tenants)
- `enabled` boolean (master switch, default `false`)
- `channels` text[] — any of `in_app`, `email`, `sms`, `whatsapp` (default `['in_app']`)
- `send_hour_local` int (0–23, default 8)
- `email_subject` text (default `"Happy Birthday, {first_name}! 🎂"`)
- `email_body` text (HTML/markdown, default branded message)
- `sms_template` text (≤320 chars, default short greeting)
- `whatsapp_template` text (default same as SMS)
- `in_app_template` text (default short greeting)
- `created_at`, `updated_at`
- RLS: admins of the tenant can `SELECT/INSERT/UPDATE`; auto-row created by trigger when tenant is created.

### 2. New table: `birthday_message_log`
- `id`, `tenant_id`, `member_id`, `channel`, `sent_on date`, `status text`, `error text`, `created_at`
- Unique index `(tenant_id, member_id, channel, sent_on)` — guarantees idempotency for the daily cron.
- RLS: admins read; service role writes.

## Edge function: `send-birthday-messages`
- Triggered by **pg_cron hourly** and by **manual invoke** from UI.
- Inputs (optional): `{ tenant_id?, member_id?, dry_run? }`.
- For each tenant where `enabled = true`:
  - Skip unless local hour matches `send_hour_local` (cron mode) — manual mode bypasses.
  - Find members with `date_of_birth` matching today's MM-DD, status active, not on suppression list.
  - For each enabled channel, render template with placeholders `{first_name}`, `{last_name}`, `{church_name}`.
  - Insert into `birthday_message_log` with `ON CONFLICT DO NOTHING` to enforce one-per-day-per-channel.
  - Dispatch via existing pipelines:
    - `in_app` → insert into `notifications` (existing system)
    - `email` → `send-transactional-email` with new template `birthday-greeting`
    - `sms` / `whatsapp` → `send-sms` (channel param)
  - Update log row with `sent` or `failed + error`.
- Honors tenant SMS quota (existing `messaging_quotas` checks in `send-sms`).

## New email template
- `supabase/functions/_shared/transactional-email-templates/birthday-greeting.tsx`
- Branded layout (church logo, navy/gold), `{first_name}` interpolation, white body.
- Registered in `registry.ts`.

## UI

### A. New Settings section: `BirthdayMessagesSection` (admins only)
Location: `src/components/settings/BirthdayMessagesSection.jsx`, mounted in `Settings.jsx` under Communications group.
- Master **Enabled** switch.
- Channel toggles (In‑app, Email, SMS, WhatsApp).
- `send_hour_local` selector (0–23).
- Editable templates per channel with a placeholder helper chip (`{first_name}` etc.) and live preview.
- "Send a test to me" button → invokes `send-birthday-messages` with `{ member_id: <self>, dry_run: false }`.

### B. Dashboard "Today's Birthdays" card (existing `UpcomingBirthdayItem`)
Add an admin-only **🎂 Send wishes** button per member that calls `send-birthday-messages` with `{ member_id, tenant_id }`. Disabled state with tooltip when log already shows `sent` for today.

## Cron schedule
Insert pg_cron job (via insert tool, contains anon key/url) running hourly:
```
0 * * * *  →  POST /functions/v1/send-birthday-messages
```

## Out of scope
- Multi-day birthday week campaigns / drip sequences
- Bulk marketing newsletter to all members on someone's birthday
- Per-member opt-out UI (suppression list already covers email; future iteration for SMS)
- Anniversary / wedding messages (separate feature)

## Files touched
- New: migration, `BirthdayMessagesSection.jsx`, `birthday-greeting.tsx`, `send-birthday-messages/index.ts`
- Edited: `registry.ts`, `Settings.jsx` (mount section), `BirthdayCelebration.jsx` (admin send button), `index.ts` of `send-transactional-email` if registry import path needs touch
- Insert cron job via insert tool (not migration)
