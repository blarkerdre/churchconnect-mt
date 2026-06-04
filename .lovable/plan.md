# Reissue Member Certificate

Allow admins / unit leaders to regenerate an already-issued certificate (e.g. after a name correction, template update, or lost PNG) without manually deleting the existing record.

## UX — `IssueCertificateDialog.jsx`

Each row in the existing "Completed Trainings" list gets two icon actions:
- **Download** — opens the existing certificate PNG in a new tab (signed URL).
- **Reissue** — opens a small confirm prompt ("Regenerate certificate for {training}? The existing certificate number will be kept and the PDF/PNG re-emailed to the member.") and calls the edge function in reissue mode.

The "Issue New Certificate" section is unchanged — disabled options for already-issued trainings stay disabled (reissue is the path for those).

After a successful reissue, the same toast pattern is used: "Certificate {number} re-issued and emailed."

## Backend — `supabase/functions/issue-certificate/index.ts`

Accept a new optional flag `reissue: true` in the request body.

When `reissue` is true:
1. Require the existing `training_completions` row (member + training_type + tenant). If missing → 404.
2. Keep the original `certificate_number` and `completion_date` (unless a new `completion_date` is supplied).
3. Re-render the SVG → PNG using the current template, upload to the same `filePath` with `upsert: true` (already the case).
4. UPDATE the existing row (refresh `certificate_url`, `notes` if provided, `updated_at`, `issued_by = caller`). Do NOT insert a new row, do NOT bump the duplicate check.
5. Re-send the certificate email if the member has an email (same flow as initial issue).
6. Write an audit log entry with action `certificate.reissued`.

When `reissue` is false / omitted → existing behaviour (409 on duplicate) is preserved.

Authorization is unchanged: admin or unit_leader in the tenant.

## Out of scope

- No new DB columns, no schema migration.
- No bulk reissue.
- No version history of past PNGs (file is overwritten in storage).
- Certificate number is preserved — not regenerated.
