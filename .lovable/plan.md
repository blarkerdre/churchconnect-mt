# Ensure emails are properly logged in System Logs

## Current state (checked `email_send_log`, last 2 days)
| Template | tenant_id present? |
|---|---|
| bible-school-exam-ready | ❌ (4 sends — all before today's `provision-exam-account` deploy) |
| course-registration | ❌ (7 sends) |
| birthday-greeting, certificate, signup, statement-of-result, tenant-invoice, welcome-registration | ✅ |

The `bible-school-exam-ready` gap is already fixed in code (this turn's deploy adds `tenant_id`), but new exam-link sends haven't been tested yet, and `course-registration` still writes rows with `tenant_id = NULL` — so course-registration emails do not appear in **System Logs → Emails** for the tenant.

## Changes

### 1. `supabase/functions/send-course-registration-email/index.ts`
The function already receives `tenant_id` in the request body but omits it from all four `email_send_log` inserts. Add `...(tenant_id ? { tenant_id } : {})` to each of the four inserts (pending, missing-API-key failure, sent, send-failure). No auth or send-path changes.

Redeploy `send-course-registration-email`.

### 2. Verify the earlier `provision-exam-account` fix end-to-end
Ask the admin to trigger one **Send exam link** and confirm the new row shows up in **System Logs → Emails** with `template_name = bible-school-exam-ready` and status `sent`. If it appears, the exam-link path is confirmed.

### 3. Optional one-off backfill for historical rows
For rows still showing `tenant_id = NULL`:
- `bible-school-exam-ready`: derive tenant from `members.email = recipient_email` (unique per tenant in practice) and update.
- `course-registration`: same lookup.

Only run this if the user wants past sends visible in System Logs; otherwise skip. Not a code change — a one-off SQL migration guarded by a `WHERE tenant_id IS NULL` clause.

## Out of scope
- No changes to any other email function (all other templates already log with `tenant_id`).
- No template, delivery, or auth changes.
