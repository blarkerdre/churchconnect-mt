

Looking at the request:
1. Clear textarea after feedback submission/update
2. Admin acknowledgment of feedback

Let me check current state of feedback files. From context I have `AppFeedbackDialog.jsx` and `FeedbackSummary.jsx` already.

**Issue 1**: After mutation success in `AppFeedbackDialog`, dialog closes but `comment` state isn't reset. When reopening, the `useEffect` reads `existing` and re-populates — but if the user wants a fresh start they can't easily clear. More importantly, after submit the comment stays in state until next open. User wants it cleared.

**Issue 2**: Admins viewing `FeedbackSummary` need to acknowledge feedback items so they can track which ones they've reviewed.

### Plan

**1. Database migration** — add acknowledgment columns to `app_feedback`:
- `acknowledged_at timestamptz`
- `acknowledged_by uuid`
- `admin_response text` (optional reply)

Update RLS: admins can UPDATE these fields (currently only own-user UPDATE allowed). Add admin update policy.

**2. `src/components/feedback/AppFeedbackDialog.jsx`**:
- After successful submit/update mutation, reset `comment` and `rating` to empty before closing dialog.
- Show acknowledgment status if `existing.acknowledged_at` is set ("Acknowledged by admin on [date]" + optional response).

**3. `src/components/feedback/FeedbackSummary.jsx`**:
- Add "Acknowledge" button next to each comment (and each rating row in the recent list).
- Show acknowledged state with checkmark + acknowledger name.
- Optional inline textarea for admin response.
- Add a tab/filter: "All / Pending / Acknowledged".
- Mutation to update `acknowledged_at`, `acknowledged_by`, `admin_response`.

### Files Changed
- New migration: add columns + admin UPDATE RLS policy on `app_feedback`
- `src/components/feedback/AppFeedbackDialog.jsx` — reset state on success, show ack status
- `src/components/feedback/FeedbackSummary.jsx` — acknowledge button, filter, response field

