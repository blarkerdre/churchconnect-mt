# Why scheduled birthday messages aren't sending

## Root cause

The hourly cron job `send-birthday-messages-hourly` is firing on schedule, but every call returns **403 Forbidden** from the `send-birthday-messages` Edge Function.

Evidence from the database:
- `cron.job_run_details` shows the job "succeeds" every hour (it just enqueues the HTTP call).
- `net._http_response` shows every request to `/functions/v1/send-birthday-messages` returns `403 {"error":"Forbidden"}` (last 6+ hours confirmed).

The Edge Function authorizes the caller by comparing the bearer token to `SUPABASE_SERVICE_ROLE_KEY`:
```ts
let authorized = bearer === serviceKey;
```
The cron job sends the bearer from the Vault secret `email_queue_service_role_key`. That Vault secret was stored on **2026-03-26** and no longer matches the current `SUPABASE_SERVICE_ROLE_KEY` — i.e. the service-role key has been rotated since, and the Vault copy is stale. So every cron call is rejected.

Manual "Send wishes" from the UI works because it uses the logged-in admin's JWT, which passes the second authorization branch (`is_admin` RPC).

## Fix

Refresh the Vault secret so cron authenticates with the current service-role key. Per project guidance, the correct way to refresh it is to re-run `email_domain--setup_email_infra` — it's idempotent and rewrites `email_queue_service_role_key` (and the related cron auth) with the latest key.

Steps:
1. Call `email_domain--setup_email_infra` to refresh `email_queue_service_role_key` in Vault.
2. Wait for the next hourly tick (or trigger one run manually) and re-check `net._http_response` for a `200` from `/send-birthday-messages`.
3. Confirm `birthday_message_log` gets new `sent` rows for any members whose birthday is today.

No code changes required.

## Not changing
- `send-birthday-messages/index.ts` authorization logic is correct.
- Cron schedule (`0 * * * *`) and per-tenant `send_hour_local = 8` are fine.
- `birthday_message_settings` rows are `enabled = true` with channels configured.
