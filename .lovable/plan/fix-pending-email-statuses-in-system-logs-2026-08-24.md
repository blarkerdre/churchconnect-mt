# Fix "pending" email statuses in System Logs

## What's actually happening

Those emails are **not stuck** — they were delivered. I checked the email log data: every follow-up reminder, signup, recovery and birthday greeting in the last 7 days has both a `pending` row and a matching `sent` row a second later.

The problem is display only. Each email writes two log rows sharing one message id:

```text
pending row  -> written by the app, includes the church (tenant) id
sent row     -> written by the background email worker, tenant id is EMPTY
```

System Logs and the Email Logs page are church-scoped, so the `sent` row (no church id) is filtered out before the page collapses the pair. Only the `pending` row survives, so the email looks stuck forever.

A one-off backfill was run previously, but the worker still writes new rows without the church id, so the issue keeps coming back.

## The fix

1. **Stamp the church on outgoing queue messages** — include the tenant id in the email payload when a message is queued, so the worker knows which church it belongs to.
2. **Worker writes the church id** — update the background email processor so every `sent`, `failed`, `rate_limited` and `dlq` log row carries the tenant id from the payload.
3. **Safety net in the database** — add a trigger on the email log: when a new row arrives with no tenant id but a matching earlier row for the same message has one, inherit it automatically. This covers older senders that don't pass the tenant along.
4. **Backfill history** — re-run the fill for existing tenant-less rows so past follow-up, signup, recovery and birthday entries flip from "pending" to their real status.
5. **Verify** — re-query the log to confirm each message now resolves to a single, correct final status, and check the System Logs email tab shows Sent instead of Pending.

## Technical details

- `supabase/functions/process-email-queue/index.ts`: 4 `email_send_log` inserts (lines ~63, 275, 302, 339) need `tenant_id: payload.tenant_id`.
- Senders calling `enqueue_email(queue_name, payload)` must add `tenant_id` into the payload JSON; the shared email helper is the single place to set it where callers already know the tenant.
- New `BEFORE INSERT` trigger on `public.email_send_log` filling `tenant_id` from the most recent same-`message_id` row when null.
- Backfill UPDATE identical to `20260614214531_backfill_email_log_tenant.sql`.
- No UI changes: the dedup logic in `SystemLogs.jsx` and `EmailDashboard.jsx` is already correct once the data is right.
