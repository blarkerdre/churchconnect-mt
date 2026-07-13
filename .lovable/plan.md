## Goal

In the Bible School **Registrations** tab (`src/pages/ExamManagement.jsx`), let admins send/resend the exam sign-in link to many approved registrants in one action, and show a clear "Link sent" status per row.

## Changes

### 1. Row-level "sent" status column
- Add a **Exam link** status column (or badge in the existing actions/status cell) rendered from `sentLinkIds` (already seeded from rows where `user_id IS NOT NULL`, meaning provisioning ran at least once).
- Values:
  - `Not sent` — grey outline badge (approved rows without `user_id` and not in `sentLinkIds`).
  - `Sent` — green badge with check icon (row is in `sentLinkIds` or `user_id` present).
  - `Sending…` — while that row's id is in an in-flight set.
- Only show for rows where `isApproved && members?.email`. For unapproved rows show `—`.

### 2. Selection UI
- Add a leading **checkbox column** to the registrations table header + each eligible row (approved + has email). Header checkbox = select-all-eligible on current filtered view.
- Track `selectedIds: Set<string>` in state. Reset when filters/tab change.
- Show a **selection toolbar** above the table when `selectedIds.size > 0`:
  - `"N selected"` text
  - Button **Send exam link to selected** (label switches to `Resend link to selected` when every selected row is already in `sentLinkIds`; if mixed, keep `Send / resend link to selected`).
  - Button **Clear selection**.

### 3. Bulk send mutation
- Add `sendBulkExamLinksMutation` in `ExamManagement.jsx`. It:
  1. Takes an array of `registration_id`s.
  2. Iterates sequentially (or in small concurrency batches of 3) calling the existing `sendExamLinkMutation` logic — i.e. `supabase.functions.invoke("provision-exam-account", { body: { registration_id } })`. Sequential-with-small-concurrency avoids hammering `admin.auth.admin.listUsers` in the edge function.
  3. Tracks per-row state via a `sendingIds: Set` and appends to `sentLinkIds` on each success.
  4. Collects successes + failures. On completion, toast: `"Sent N link(s). M failed."` with failure details in a secondary toast/console.
  5. Invalidates `course-registrations` and `wofbi-applications` queries once at the end.
- Existing single-row **Send / Resend** button in the actions cell stays; it just wraps the same underlying invoke.

### 4. "Send to all approved" convenience
- In the selection toolbar (visible whenever the current filter view has ≥1 eligible row), also render a secondary button **Select all approved with email** that sets `selectedIds` to every eligible row across the current filtered dataset (not just current page). This gives the "send to all" affordance without an extra confirm — the actual send still requires clicking `Send exam link to selected`, and that click opens a `DangerConfirmDialog`-style confirm when count > 5 to prevent accidents.

### 5. Confirm dialog for bulk sends
- Reuse existing `DangerConfirmDialog` (or a lighter `ConfirmDialog` if one exists — otherwise inline `AlertDialog`). Copy:
  - Title: `Send exam link to N registrant(s)?`
  - Body: `Each recipient will get a single-use magic sign-in link by email. Resending replaces any previous unused link.`
  - Confirm label: `Send links`.

### 6. Visual status persistence across reload
- `sentLinkIds` currently seeds from `user_id IS NOT NULL`. Keep that. Additionally, treat any row with `student_number` present or any prior successful send in this session as "sent". No schema change — `user_id` already reliably reflects that provisioning + link generation ran.

## Technical notes

- No backend/edge function changes. `provision-exam-account` already accepts `registration_id` and is idempotent per user (reuses existing auth user + member).
- No new DB columns. Sent state is derived from `course_registrations.user_id` (proxy for "we've provisioned + emailed at least once") plus in-session `sentLinkIds`.
- Concurrency: cap at 3 parallel invokes using a simple `Promise.all` over sliced chunks.
- Keep the Applications tab unchanged.

## Out of scope

- No "last sent at" timestamp column (would need a schema change; can be added later).
- No per-tenant rate limiting UI.
- No changes to the email template or magic-link expiry.

## Result

- Admins can multi-select approved registrants (or select all eligible) and send/resend exam links in one action.
- Each row shows `Sent` / `Not sent` / `Sending…` status.
- Existing single-row Send/Resend button and Applications tab behavior are unchanged.
