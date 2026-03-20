

## Fix: Remove invalid `run_id` from certificate email payload

### Problem
Certificate emails fail with `404 run_not_found` because the payload includes a self-generated `run_id` (`cert-<uuid>`). The email API expects `run_id` to reference an existing run in its system — a random UUID is not valid.

Per the email infrastructure, transactional emails do **not** require a `run_id`. When `idempotency_key` is provided with `purpose: "transactional"` and no `run_id`, the API creates a run inline.

### Fix
**`supabase/functions/issue-certificate/index.ts`** (line 261):
- Remove the `run_id: messageId` line from the `emailPayload` object.
- Keep everything else (message_id, idempotency_key, unsubscribe_token, text, etc.) as-is.

Then redeploy the `issue-certificate` edge function.

### Also
- Clean up the stuck failed message (msg_id 9) from the transactional queue so it doesn't keep retrying with the bad payload.

