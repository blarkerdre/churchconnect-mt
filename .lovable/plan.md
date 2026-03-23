

## Plan: Fix `run_not_found` Email API Error

### Problem
Three edge functions are setting `run_id: messageId` in their email payloads. For transactional emails, the `run_id` must be **omitted** — the email API auto-creates a run from the `idempotency_key`. Including a fake `run_id` causes a `404 run_not_found` lookup failure.

### Affected Functions
1. `supabase/functions/send-email-alert/index.ts` (line 143)
2. `supabase/functions/notify-followup-assignment/index.ts` (line 127)
3. `supabase/functions/notify-pastoral-assignment/index.ts` (line 125)

### Changes
Remove the `run_id` field from the email payload in all three functions. Everything else stays the same — `message_id`, `idempotency_key`, and `purpose: "transactional"` are already correct.

### Deployment
Redeploy all three edge functions after the fix.

