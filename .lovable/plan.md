## Problem

Two gaps in Bible School result delivery:

1. **Certificate email ignores the toggle.** `exam_titles.send_certificate_email` is passed into the `issue-certificate` Edge Function but never checked — certificates are always emailed to the member when issued. (The `send_result_email` toggle is already honoured for per-subject result emails.)
2. **No manual send path.** When toggles are off, admins have no way to deliver a Statement of Result or Certificate to a specific member or a group.

## Changes

### 1. Honour `send_certificate_email` in `issue-certificate`
- Read the `send_certificate_email` flag already sent in the request body.
- Add an `admin_override` (a.k.a. `force_send`) boolean to the request body.
- Skip the certificate email block when `send_certificate_email === false` AND `admin_override !== true`.
- Certificate row is still created + stored, member profile boolean still flipped — only the automatic email is suppressed.

### 2. New Edge Function: `send-statement-email`
- Input: `{ member_id, course_id, tenant_id }` (single) or `{ member_ids: [], course_id, tenant_id }` (bulk).
- Server-side: rebuild the same Statement HTML currently rendered in `StatementOfResult.jsx` (best-attempt aggregation per subject, letter grades, pass/fail) and send via the existing email pipeline used by `grade-exam`'s `sendResultEmail_fn`.
- Always sends when invoked (this is the manual admin path); ignores `send_result_email` toggle.

### 3. Admin UI in `CourseResultsView.jsx`
Add two admin actions to the results table:

- **Per-row menu** on each member row: "Send Statement" and "Resend Certificate" (only when member completed all subjects; certificate option only when eligible per pass mark).
- **Bulk bar** above the table: checkbox column + "Send Statement to selected" / "Send Certificate to selected" buttons. Include a "Select all passed" quick action.

Both actions call the new/updated Edge Functions with `admin_override: true` and show a toast summarising success/failure counts. Guarded to admin/tenant-admin roles.

### 4. UI copy in `ExamManagement.jsx`
Under the two email toggles, add a small helper note: "When off, results/certificates are not auto-emailed. Admins can still send them manually from the Results view."

## Technical notes

- `exam_titles` already stores both flags; no schema change.
- `issue-certificate` change is a single guard around the existing email block; response payload unchanged.
- The new `send-statement-email` function reuses the sender domain, unsubscribe-token lookup, and HTML wrapper pattern from `grade-exam`'s `sendResultEmail_fn` (branding, tenant name, etc.). Tenant-scoped queries throughout.
- Bulk send loops server-side (one enqueue per recipient) to keep individual retry/DLQ behaviour intact.
- No changes to `StatementOfResult.jsx` rendering — the same layout is reused for the email HTML.
- Deploy affected functions after edit: `issue-certificate`, `send-statement-email`.

## Out of scope

- No in-app (bell) notifications for exam results — none exist today, so nothing to suppress.
- No changes to grading logic, retake rules, or certificate template design.
