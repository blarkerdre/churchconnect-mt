## Problem

Today's birthday emails for Inimfon and Tajudeen were actually delivered (Mailgun accepted them), but the Email Dashboard shows them as "Pending".

Each app email writes two rows to `email_send_log`:
1. `status='pending'` — written by `send-transactional-email`, **includes `tenant_id`**.
2. `status='sent'` (or `dlq`/`failed`/`rate_limited`) — written by `process-email-queue`, **missing `tenant_id`**.

The Email Dashboard scopes its query by `tenant_id`, so the terminal `sent` rows are filtered out for tenant admins. Dedup then keeps only the surviving `pending` row, and every successfully delivered app email is mislabelled as Pending. This affects all app emails (welcome, invitations, receipts, birthday greetings), not just birthdays.

## Fix

### 1. `supabase/functions/process-email-queue/index.ts`
Add `...(payload.tenant_id ? { tenant_id: payload.tenant_id as string } : {})` to all five `email_send_log` inserts that currently omit it:
- `moveToDlq` helper (`status: 'dlq'`)
- success branch (`status: 'sent'`)
- rate-limited branch (`status: 'rate_limited'`)
- failed branch (`status: 'failed'`)
- any other status insert in the worker

The payload already carries `tenant_id` from `send-transactional-email`'s `enqueue_email` call, so no changes are needed upstream.

### 2. Backfill historical rows
One-off SQL migration: for every `email_send_log` row where `tenant_id IS NULL`, copy the `tenant_id` from any sibling row sharing the same `message_id` that has it set.

```sql
UPDATE public.email_send_log AS dst
SET tenant_id = src.tenant_id
FROM (
  SELECT DISTINCT ON (message_id) message_id, tenant_id
  FROM public.email_send_log
  WHERE tenant_id IS NOT NULL
) src
WHERE dst.message_id = src.message_id
  AND dst.tenant_id IS NULL;
```

This restores correct status display for all past app emails in the tenant dashboard.

### 3. Deploy & verify
- Deploy `process-email-queue`.
- Trigger a fresh app email (e.g. manual birthday for a test member) and confirm both the `pending` and `sent` rows carry `tenant_id`, and the dashboard shows "Sent".

## Out of scope
- No change to `send-birthday-messages`, the queue infrastructure, the dashboard UI, or `send-transactional-email`.
- No change to dashboard filter behaviour — scoping by `tenant_id` is correct; the data was wrong.
