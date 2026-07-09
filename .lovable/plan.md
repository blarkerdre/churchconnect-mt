## Root Cause

In **Course Results → Send Certificates** (bulk action in `src/components/exams/CourseResultsView.jsx`, `sendCertificates`, line 225-257), every call to the `issue-certificate` Edge Function is made with `reissue: true`:

```js
supabase.functions.invoke("issue-certificate", {
  body: {
    member_id: id,
    training_type: course.name,
    tenant_id: course.tenant_id,
    reissue: true,            // ← always true
    admin_override: true,
    send_certificate_email: true,
  },
})
```

Inside `issue-certificate/index.ts` (~line 213), the reissue branch requires an **existing** `training_completions` row:

```
"No existing certificate found to reissue"
```

So the very first time an admin bulk-sends BCC / LCC / LDC certificates for members who passed but haven't been issued anything yet, every call returns an error. The bulk loop counts them under `fail`, and the toast reads:

> **Certificates processed** — 0 sent, N failed

That is exactly the "processed but not sent" symptom.

Members who already had a certificate row (e.g. earlier auto-issue via `grade-exam` → `checkCourseCompletion`) do get re-emailed, which is why some historic BCC/LCC/LDC certificates in `email_send_log` show `sent` — but the group that never had an auto-issued row never receives anything.

Contributing factor: duplicate `exam_titles` rows (e.g. "Basic Certificate Course" with `send_certificate_email=false` and "Basic Certificate Course (BCC)" with `true`). If a subject's `course_id` points to the disabled variant, `grade-exam` will not auto-issue+email the certificate on completion either, leaving those members in the "no existing completion" state above.

## Fix

1. **`src/components/exams/CourseResultsView.jsx`** — In `sendCertificates`, do not force `reissue: true`. Detect per-member whether a completion already exists and only set `reissue: true` for those; otherwise issue a first-time certificate. Simplest safe change: drop `reissue: true` from the payload entirely and rely on `issue-certificate`'s existing idempotent logic (it already reuses an existing `certificate_number` when the row exists, and creates one when it doesn't). Keep `admin_override: true` and `send_certificate_email: true` so the email is always sent.

2. **Toast wording** — Update the bulk toast so "processed" isn't confused with "sent":
   - Title: `Certificates sent` when `fail === 0`, else `Certificates partially sent`.
   - Description: `${ok} emailed${fail ? \`, ${fail} failed\` : ""}`.

3. **Post-completion sanity** — After the bulk run, invalidate the `training-completions` and `course-attempts` queries so the UI reflects the new completions.

4. **Data hygiene (optional but recommended, admin-facing note only, no code)** — Flag to the tenant admin that duplicate `exam_titles` (e.g. two "Basic Certificate Course" entries with different email toggles) exist and should be consolidated so `grade-exam` picks the enabled row.

## Verification

1. Pick a BCC member who has passed all subjects but has no `training_completions` row.
2. Select them in Course Results → **Send Certificates**.
3. Confirm:
   - Toast: `Certificates sent — 1 emailed`.
   - New row in `training_completions` with a valid `certificate_number` and `certificate_url`.
   - New `email_send_log` row `template_name = 'certificate'`, `status = pending → sent`.
   - Email lands in the member's inbox with the Download Certificate link.
4. Re-run for the same member: certificate number is preserved, file regenerated, new email sent (reissue path).
5. Repeat for LCC and LDC.

No backend/edge-function changes required — this is a client-side fix in `CourseResultsView.jsx`.