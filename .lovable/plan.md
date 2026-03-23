

## Plan: Fix `run_not_found` Email API Error — RESOLVED

### Root Cause
The `process-email-queue` worker was forwarding `run_id` from any queued payload to the email API. For transactional emails, the API expects no `run_id` — it creates a run inline from the `idempotency_key`. Sending a fabricated `run_id` caused `404 run_not_found`.

### Fix Applied
Updated `process-email-queue/index.ts` to only forward `run_id` when processing the `auth_emails` queue. For `transactional_emails`, `run_id` is now explicitly stripped regardless of what the payload contains. This protects against stale payloads and future regressions.

### Deployed Functions
All six email-related edge functions redeployed:
- `process-email-queue` (the fix)
- `issue-certificate`
- `send-welcome-email`
- `send-email-alert`
- `notify-followup-assignment`
- `notify-pastoral-assignment`

### Queue Status
- Main queue (`transactional_emails`): empty — no active issues
- DLQ: contains 7 historical messages (some with legacy `run_id`), left for audit
