# Fix birthday auto-send (403 Forbidden from cron)

## Diagnosis

The `send-birthday-messages-hourly` pg_cron job is running on schedule, but every call to the Edge Function returns **403 Forbidden** (confirmed in `net._http_response` — last 6 hours all 403). That is why no birthday email / SMS / WhatsApp / in-app messages are going out and there are zero logs for the function.

Why:
- `send-birthday-messages/index.ts` accepts a cron call only when the request bearer equals `Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')` (the current live service-role key).
- The cron job authenticates with the Vault secret `email_queue_service_role_key`.
- Those two values no longer match — almost certainly because the project's service-role key was rotated at some point and the Vault secret wasn't refreshed. Same root cause documented for the email queue dispatcher.

Manual UI sends still work because they use the admin user's JWT (the second auth branch in the function), which is unaffected.

## Fix

Refresh the Vault secret `email_queue_service_role_key` so it equals the current `SUPABASE_SERVICE_ROLE_KEY`, then re-trigger the cron once to confirm.

Steps:
1. Run `email_domain--setup_email_infra` (idempotent — it rewrites the Vault secret `email_queue_service_role_key` with the current service-role key and re-installs the email queue cron). This also unblocks `process-email-queue`, which uses the same secret.
2. Verify by inserting one immediate run of the birthday cron command and checking `net._http_response` returns `200`.
3. Check `edge_function_logs` for `send-birthday-messages` to confirm it now executes and enqueues messages.

No code or schema changes are required. The function logic, the cron schedule, and the birthday-message channel routing are all correct — only the bearer token used by cron is stale.

## Out of scope

- No changes to `send-birthday-messages` source.
- No changes to the cron schedule (stays hourly).
- No changes to message templates or per-tenant settings.
