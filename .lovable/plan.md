

## Why Blarker Dre never gets a "decline" notification

### What's happening for Blarker (member ID `465f90c3…`)

She has two join requests in the Cardiff tenant:

| Request | Status | When |
|---|---|---|
| Join **Ushering** unit | approved 18 Apr 20:51 | by Adeniyi |
| Join **Cathays Centre** (home cell) | declined 21 Apr 11:16 with reason "Please try again next month" | by Adeniyi |

Both decisions correctly created an **in-app bell notification** for her — they exist in the `notifications` table, addressed to her user id, and are visible in the bell on her profile / dashboard. So if "rejection notification" means the in-app bell, it WAS sent and is sitting there.

### If the user means email/SMS rejection notification

There is **no email or SMS sent on approve/decline anywhere in the codebase**. The decline path (`public.decline_join_request` SQL function) only does three things:

1. Marks the request `declined`
2. Writes an audit log row
3. Inserts a single in-app `notifications` row

The same is true for `approve_join_request`. The `notify-join-request` edge function only fires when a member **submits** a request (to alert admins/leaders) — it has no decline/approve branch.

So Blarker has never received an email or SMS about either decision because the feature was never built. The previous fix just made sure the leader-side widget showed pending requests, not that the requester got an email when a decision was made.

### Side issue I noticed (separate problem)

When Blarker first submitted her two requests on 18 Apr, the `notify-join-request` function tried to notify the approvers (Adeniyi, plus Blarker herself because she's a tenant admin/leader, which is its own bug — admins are emailed about their own requests). All 16 of those emails went to the dead-letter queue (`email_send_log.status = 'dlq'`) after 5 retries. Worth flagging but not what this fix is about.

### Proposed fix — add member-side email + SMS on approve and decline

Mirror the existing `notify-join-request` pattern but for the requester:

1. Create a new edge function `notify-join-decision` with a payload of `{ request_id, decision: 'approved' | 'declined', reason? }`. It will:
   - Look up the request, member, target unit / centre, tenant branding
   - Look up the requester's email + phone from `members` (and `profiles` for fallback email)
   - Check `app_settings.sms_notifications_enabled` (same toggle the other notifier uses)
   - Check `suppressed_emails` before sending
   - Enqueue one email via `enqueue_email` to the `transactional_emails` queue with template label `join-request-decision`, subject "Your request to join {target} was {approved|declined}", branded HTML using the existing tenant header style
   - Send one SMS via the Twilio gateway when phone + keys exist
   - Skip silently if no contact info — the in-app notification is still created by the SQL function as a baseline

2. Invoke it from the client right after the RPC succeeds, in `src/hooks/usePendingJoinRequests.jsx`:

   ```text
   useApproveJoinRequest.onSuccess  →  invoke notify-join-decision { decision: 'approved' }
   useDeclineJoinRequest.onSuccess  →  invoke notify-join-decision { decision: 'declined', reason }
   ```

   Fire-and-forget with `.catch(console.error)` so a notification failure never blocks the UI.

3. **Idempotency key**: `join-decision-{request_id}-{decision}` so retries can't duplicate sends.

4. **Permission**: edge function accepts the user's JWT (same pattern as `notify-join-request`) and re-validates internally that the request is actually approved/declined and the caller is admin / unit leader / home cell leader for the request — using the same RPC helpers (`is_admin`, `is_unit_leader_for_session`, `is_home_cell_leader_for_centre`).

5. **No backend table changes** — `email_send_log` and `email_unsubscribe_tokens` already cover this, and the in-app notification is already created by the SQL function. No RLS work needed.

6. **Backfill for Blarker's already-declined Cathays Centre request**: since the decision happened today before the fix existed, after deploying we'll trigger one manual invocation for `1ff3f240-f901-426c-ac80-cec667f4f6bd` so she gets the email she missed.

### What it will look like to Blarker

When her Cathays Centre request was declined with reason "Please try again next month", she'd receive:

- **Email** "Your request to join Cathays Centre was declined" — with church branding, the reason quoted, and a link to view her profile.
- **SMS** "Hi Blarker, your request to join Cathays Centre was declined. Reason: Please try again next month. — Winners Chapel Cardiff" (only if she had a phone — she currently doesn't).
- The existing in-app bell notification (already there).

### Verification

1. Sign in as a unit leader, decline a pending request from a test member who has an email → confirm `email_send_log` has a `pending` row with template `join-request-decision`, then `sent`.
2. Approve a different request → confirm a new email row with subject "approved".
3. Decline without a reason → email omits the "Reason:" line cleanly.
4. Member has no email and no phone → function returns success with `notified: 0`, no log rows.
5. Re-approve / re-decline same request → second invocation no-ops via idempotency key.
6. Manually invoke once for Blarker's `1ff3f240…` and confirm she receives the email.

