
Goal: resolve the current `404 run_not_found` email failure.

What I found
- The current code for `send-email-alert`, `notify-followup-assignment`, and `notify-pastoral-assignment` already omits `run_id`.
- `process-email-queue` only forwards `run_id` when it exists in the queued payload, which is correct.
- Recent backend logs show the `run_not_found` failures were on `certificate` emails, not on the three functions above.
- The transactional queue is currently empty, and a later certificate email was sent successfully, which points to stale deployed code or old retried messages rather than the current repository state.

Plan
1. Reproduce the failure through the exact action that triggers it, most likely certificate issuing, and capture the fresh `message_id` plus its send-log entries.
2. Verify the live flow for the certificate sender and queue worker, then redeploy the relevant backend functions so the deployed code matches the fixed payload format.
3. Remove or quarantine only stale failed queue/DLQ messages that were created with the old payload shape, so they stop retrying and generating misleading 404s.
4. Confirm app-email payloads omit `run_id`, while auth-email payloads keep their webhook-provided `run_id`.
5. Re-test end to end and confirm the new email moves from `pending` to `sent` with no new `run_not_found` entries.

Technical detail
- `run_id` should only be present for auth-hook emails.
- App emails sent through the transactional queue must rely on `idempotency_key` and omit `run_id`.
- Based on current code and logs, the highest-probability fix path is the certificate flow plus deployment/queue cleanup, not the auth flow.
