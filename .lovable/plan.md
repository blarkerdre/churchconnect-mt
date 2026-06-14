## Why Mercy Itoro didn't get a birthday message

Mercy's record is fine:
- DOB `1997-06-14` (matches today), status Active, email + phone present, linked user account.
- Tenant settings: enabled, channels `in_app/email/sms`, send hour 08:00 local.
- Hourly cron `send-birthday-messages-hourly` is active and fired at 07:00 UTC (= 08:00 BST, the configured hour).

But every cron invocation today is failing with **HTTP 403 `{"error":"Forbidden"}`** (confirmed in `net._http_response` — 20+ consecutive 403s, including 07:00, 07:05, 08:00, 08:05, 08:10). Because the function rejects the call before any work runs, no rows are written to `birthday_message_log` and nobody with a birthday today received anything — this is not specific to Mercy.

The 403 comes from the auth check in `send-birthday-messages/index.ts`:
```
let authorized = bearer === serviceKey;
```
The cron sends `Bearer <vault: email_queue_service_role_key>`; the function compares against the `SUPABASE_SERVICE_ROLE_KEY` env. They no longer match — classic symptom of a Supabase service-role key rotation (the Vault copy went stale).

## Fix plan

1. **Refresh the Vault service-role secret** by re-running the email infrastructure setup tool (`email_domain--setup_email_infra`). This is idempotent and exists specifically to refresh `email_queue_service_role_key` after a key rotation — no cron/SQL/Vault edits by hand.
2. **Verify**: re-check `net._http_response` for the next cron tick — expect `200` with a JSON `{processed, sent, failed}` payload instead of 403.
3. **Manual catch-up for today's birthdays** (Mercy + anyone else born 14 June): invoke `send-birthday-messages` once with body `{ "tenant_id": "95e53cc3-…" }` (cron mode, not manual/test mode) so real `birthday_message_log` rows are written and the unique constraint prevents double-sends when the next hourly tick runs.
4. **Confirm delivery** by reading `birthday_message_log` for `member_id = 227919a7-4ba7-44d4-947e-70a49a91275c` — expect rows with `status='sent'` for `in_app`, `email`, `sms`.

## Out of scope

- No code changes to `send-birthday-messages` (logic is correct; only the secret is stale).
- No change to cron schedule, templates, or settings.
- No changes to other functions, even though the same rotated key likely affects `process-email-queue` etc. — the setup-infra refresh covers all functions that read this Vault secret in one shot.
