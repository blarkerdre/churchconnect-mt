## Goal
The Exam link column should show "Sent" only when the exam link has actually been emailed for that registration. A member who happens to have an auth account for other reasons must not appear as "Sent". Once sent, the button becomes "Resend link".

## Root cause
In `src/pages/ExamManagement.jsx`, the UI computes:
```
const alreadySent = sentLinkIds.has(r.id) || !!r.members?.user_id;
```
The `!!r.members?.user_id` fallback treats any linked auth user as "exam link sent", which is wrong.

## Changes

### 1. Track real sends in the database
Add a column `exam_link_sent_at timestamptz` on `course_registrations`. Set it when `provision-exam-account` successfully sends the exam-ready email.

- Migration: `ALTER TABLE public.course_registrations ADD COLUMN exam_link_sent_at timestamptz;` (nullable, no backfill — historical unknown sends stay null, i.e. "Not sent", which matches the user's requirement).
- Edit `supabase/functions/provision-exam-account/index.ts`: after `send-transactional-email` returns without error (i.e. `emailSent === true`), update the matching `course_registrations` row (`tenant_id + member_id + course_id`) with `exam_link_sent_at = now()`. Do NOT set it if the email invoke failed.

### 2. Read the flag on the Registrations page
Edit `src/pages/ExamManagement.jsx`:
- Include `exam_link_sent_at` in the `course_registrations` select for that page.
- Replace the `alreadySent` derivation with:
  ```
  const alreadySent = sentLinkIds.has(r.id) || !!r.exam_link_sent_at;
  ```
  (drop the `members.user_id` fallback entirely).
- Button label logic already switches to "Resend link" when `alreadySent` is true — keep as-is; it will now only appear after a real send.
- Bulk label ("Resend link to selected" vs "Send exam link to selected") continues to work off the same flag.

### 3. Invalidate query after send
On successful single/bulk send, the mutations already call `qc.invalidateQueries(["course-registrations", ...])`. Confirm both `sendExamLinkMutation.onSuccess` (single) and the bulk one invalidate — add the invalidate to the single-send success handler if missing, so the badge picks up `exam_link_sent_at` from the DB on next render (in addition to the optimistic `sentLinkIds` set).

### 4. Deploy
Redeploy `provision-exam-account`.

## Out of scope
- Applications tab, Bible School application page, approve flow, student-number email.
- RLS/policies/roles/RPCs.
- Backfilling `exam_link_sent_at` for prior sends — historical rows will show "Not sent" until an admin resends (matches "should only show as sent when exam link is sent").

## Files touched
- `supabase/migrations/<new>.sql` (add column)
- `supabase/functions/provision-exam-account/index.ts` (stamp column on success)
- `src/pages/ExamManagement.jsx` (select the column, drop user_id fallback, ensure invalidate on single-send success)
