## Diagnosis
Each email writes two rows to `email_send_log` sharing a `message_id`: a `pending` row at enqueue, then a `sent` / `dlq` / `failed` row when the worker finishes. The main Email Logs page deduplicates correctly. Two other views do not, so historic `pending` rows appear next to their `sent` counterparts and look stuck.

Database confirms only **1** email is genuinely still pending; the rest of the apparent "pending" entries are duplicates of already-sent emails.

## Changes

**`src/pages/Communications.jsx`**
- `MemberEmailList` (~line 231): after fetching, dedupe by `message_id` (keep latest by `created_at`) before rendering.
- Admin email list query (~line 415): apply the same dedupe step.

**`src/pages/SystemLogs.jsx`**
- Email logs query (~line 113): after fetch, dedupe by `message_id` so only the latest status row per email is listed. Rows with null `message_id` keep their own row.

Helper: a small inline `dedupeByMessageId(rows)` function (or shared util) used by all three call sites — same logic already in `EmailDashboard.jsx`.

## Out of scope
- No DB / RLS / edge-function changes.
- Not touching `EmailDashboard.jsx` (already correct).
- Not retrying or cleaning up the 1 genuinely pending row and 42 DLQ rows — separate concern; can investigate if you want.