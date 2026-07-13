## Goal

In Course Results (`src/components/exams/CourseResultsView.jsx`), let admins send the **Statement of Result** and the **Certificate** separately or together, and **preview both** before sending — for a single member or in bulk.

## Changes (frontend only)

### 1. New "Send Results" dialog — `src/components/exams/SendResultsDialog.jsx`

A single dialog reused for per-member and bulk. Props: `open`, `onOpenChange`, `course`, `members` (array of `{ id, name, passed, subjects, member_email? }`), `tenantId`, `onSent`.

Sections:

- **What to send** — two checkboxes (default both on):
  - `Statement of Result`
  - `Certificate` (only enabled if at least one selected member has `passed === true`; shows helper text "N of M eligible" when some are not passed)
- **Recipients summary** — list selected members with badges: `Statement ✓`, `Certificate ✓ / — not passed`.
- **Preview panel** with a member switcher (dropdown of selected members) and two tabs:
  - **Statement** — inline render using the existing `StatementOfResult` on-screen preview markup (reuse the JSX block that already builds the on-screen statement in `StatementOfResult.jsx`; extract to a small `StatementPreview` subcomponent exporting the render body without the outer Dialog wrapper).
  - **Certificate** — image returned from `supabase.functions.invoke("issue-certificate", { body: { member_id, training_type: course.name, tenant_id, preview: true, admin_override: true, reissue: <existingCompletion> } })`. Shows spinner while loading; error state if the member is not passed.
- **Footer** — `Cancel` and `Send N …` primary button. Button label reflects selection:
  - Both: `Send statement & certificate to N`
  - Statement only: `Send statement to N`
  - Certificate only: `Send certificate to N eligible` (N excludes not-passed)
  - Confirm dialog when total send count > 5.

Send logic on confirm:
1. If Statement selected → one call to `send-statement-email` with all `member_ids`.
2. If Certificate selected → sequential `issue-certificate` calls (mirroring current `sendCertificates` in `CourseResultsView.jsx`), filtered to `passed` members, using `reissue: existingSet.has(id)`, `admin_override: true`, `send_certificate_email: true`.
3. Aggregate result toast: `Statements: X sent, Y failed · Certificates: A sent, B failed (C skipped)`.
4. Invalidate `training-completions` and `course-attempts`; call `onSent()`; close.

### 2. Wire into `CourseResultsView.jsx`

- Add `sendDialog` state `{ open, memberIds }`.
- **Bulk toolbar (line ~374-388)**: replace the two buttons "Email Statement" and "Email Certificate" with a single primary button `Preview & Send…` that opens the dialog with `selected` ids. Keep an "Advanced" split later if needed — not now.
- **Per-row (line ~450-473)**: replace the two per-row `Email` / `Certificate` buttons with a single `Send…` ghost button per row (icon `Send`) opening the dialog with just that member. Row-level "Statement" view button (opens `StatementOfResult` in read-only) stays unchanged.
- Keep the existing standalone `sendStatements` / `sendCertificates` functions available but no longer wired to buttons — safe to delete once the dialog is in.

### 3. Extract `StatementPreview` from `StatementOfResult.jsx`

Refactor: move the on-screen preview JSX (currently inside the Dialog around `StatementOfResult.jsx:355`) into a named export `StatementPreview` that takes the same computed props (`course`, `member`, `subjects`, `tenant`, etc.). `StatementOfResult` keeps wrapping it in a Dialog with print/download buttons. `SendResultsDialog` imports and renders `<StatementPreview .../>` directly for each member — no duplicate markup.

## Out of scope

- No backend/edge function changes. Both `send-statement-email` (accepts `member_ids[]`) and `issue-certificate` (supports `preview: true`) already do what's needed.
- No PDF preview inside the dialog for the statement (HTML preview mirrors the PDF layout, matches current behavior).
- No scheduling, "send later", or per-recipient template overrides.
- No changes to the Applications tab or Registrations tab.

## Technical notes

- Certificate preview response shape (from existing `IssueCertificateDialog`): `{ image, meta }`. Reuse handling.
- Certificate eligibility mirrors current logic: only `passedMembers` receive certs; not-passed selections are marked "skipped".
- Concurrency for cert sends: sequential (matches current implementation) to avoid concurrent inserts on `training_completions`.
- No new tables or RPCs.

## Result

Admins can, from Course Results:
- Select one or many members, click **Preview & Send**, choose Statement / Certificate / both, flip through per-member previews, then send in one action.
- Row-level `Send…` opens the same dialog scoped to that member.
