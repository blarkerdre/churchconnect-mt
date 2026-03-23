

## Plan: Fix `missing_unsubscribe` Email API Error

### Problem
The `send-email-alert` Edge Function enqueues transactional emails **without** an `unsubscribe_token`. The Email API requires all transactional emails to include one, resulting in a `400 missing_unsubscribe` rejection.

### Root Cause
The payload built at line 142–154 of `send-email-alert/index.ts` omits `unsubscribe_token`. The other senders (certificate, welcome, follow-up, pastoral) already include it.

### Fix
Update `send-email-alert/index.ts` to:
1. Look up (or create) an unsubscribe token for each recipient email from the `email_unsubscribe_tokens` table before enqueuing
2. Include `unsubscribe_token` in the queued payload

This matches the pattern already used in `send-welcome-email` and `issue-certificate`.

### Changes
**File: `supabase/functions/send-email-alert/index.ts`**
- Add a helper function `getOrCreateUnsubscribeToken(supabase, email)` (same pattern as in `send-welcome-email`)
- Inside the member loop, call it for each recipient and add `unsubscribe_token` to the payload

### Deployment
Redeploy `send-email-alert`. The stuck message (msg_id 11) in the queue will be retried automatically by `process-email-queue` once the token is present — but since the *payload* is already in the queue without a token, the existing message will continue to fail until it hits max retries and moves to DLQ. No manual queue intervention needed; new sends will work correctly.

