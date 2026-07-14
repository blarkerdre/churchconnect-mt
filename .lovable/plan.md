# Fix: Exam link emails missing from System Logs

## Why they're missing
`System Logs → Emails` reads `email_send_log` through `useTenantQuery().scopeQuery(...)`, which filters by the active `tenant_id`. `provision-exam-account` calls `send-transactional-email` **without** a `tenant_id` in the request body, so the log rows are written with `tenant_id = NULL` and are invisible in the tenant-scoped view — even though the email actually sent (confirmed for the 12:31 UTC send to blarkerdre@yahoo.com).

## Change
File: `supabase/functions/provision-exam-account/index.ts`

In the `admin.functions.invoke("send-transactional-email", { body: {...} })` call, add:

```
tenant_id: app.tenant_id,
```

That's the only change. `send-transactional-email` already reads `body.tenant_id` (or `tenantId`) and stamps it on every `email_send_log` row it writes (`pending`, `sent`, `suppressed`, `failed`).

## Backfill (optional, one-off)
Historical exam-link rows currently have `tenant_id = NULL`. If you want past sends to show up too, run a one-off SQL update matching `template_name = 'bible-school-exam-ready'` to the tenant of the recipient's `members` row. Skip if you only care from now on.

## Verification
1. Deploy `provision-exam-account`.
2. Click **Send exam link** on any approved application.
3. Open **System Logs → Emails** for that tenant — the new `bible-school-exam-ready` row should appear within seconds with status `pending` → `sent`.

## Out of scope
- No change to `send-transactional-email`, the template, magic-link generation, or the client toast logic (already fixed in the previous turn).
