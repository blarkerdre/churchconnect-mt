# Fix "pending" duplicates in System Logs → Emails

## Diagnosis

The `email_send_log` table is append-only: every email writes a `pending` row on enqueue, then a second row (`sent`/`failed`/`dlq`/`suppressed`) when the dispatcher finishes. The two rows share a `message_id`.

Checked the DB: in the last week, every "pending" entry has a matching "sent" row 1–5 seconds later. **No emails are actually stuck.** It's purely a display problem.

`src/pages/SystemLogs.jsx` queries `email_send_log` without deduplicating, so each email is rendered twice and the Pending stat card is always inflated.

## Fix

Edit `src/pages/SystemLogs.jsx` only:

1. In the email query (around line 113), keep fetching the raw rows (we still need the time window + filters), then collapse to the latest row per `message_id` in JS before computing stats and rendering the table:
   - Group by `message_id` (fall back to `id` when null).
   - Keep the row with the most recent `created_at` per group.
2. Apply the existing status filter **after** dedup, so selecting "Pending" only shows emails whose *latest* status is still pending (i.e. genuinely in-queue), not every email ever sent.
3. Recompute `stats` (total / sent / failed / pending / suppressed) from the deduped list so the cards match reality.
4. Leave everything else (auth logs, edge logs, other tabs) untouched.

## Out of scope

- No DB / migration changes.
- No edge function changes.
- No changes to how emails are logged or processed — the queue is working correctly.
