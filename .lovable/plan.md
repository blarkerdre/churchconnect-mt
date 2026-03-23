

## Plan: Fix `missing_unsubscribe` Email API Error — RESOLVED

### Problem
The `send-email-alert` Edge Function enqueued transactional emails **without** an `unsubscribe_token`, causing `400 missing_unsubscribe` rejections from the Email API.

### Fix Applied
Updated `send-email-alert/index.ts` to:
1. Added `getOrCreateUnsubscribeToken()` helper (same pattern as `send-welcome-email`)
2. For each recipient, looks up or creates an unsubscribe token in `email_unsubscribe_tokens`
3. Includes `unsubscribe_token` in the enqueued payload

### Deployed
- `send-email-alert` redeployed successfully

### Note
The stuck message (msg_id 11) already in the queue without a token will continue to fail until it exhausts retries and moves to DLQ. New email alerts will include the token and send successfully.
