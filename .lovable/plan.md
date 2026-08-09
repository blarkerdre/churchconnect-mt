# Bulk certificate download inside Bible School

Certificates can already be bulk downloaded from the Certificates Report page. This adds the same capability directly inside Bible School, next to the existing statement bulk actions, so an admin can select students on a course and download all their certificates in one go.

## What changes

In Bible School → Course Results, the selection toolbar currently offers "Merged PDF", "ZIP" (statements) and "Send". Two certificate actions are added alongside them:

- Certificates PDF — one landscape A4 page per selected student's issued certificate, merged into a single file for printing.
- Certificates ZIP — the original certificate images, one file per student, named by certificate number.

Behaviour:
- Only students who actually have an issued certificate for this course are included; students without one are skipped and reported in the completion message ("18 downloaded, 4 skipped — no certificate issued").
- A progress toast shows "12 of 40…" while files are fetched.
- If none of the selected students have a certificate, a clear message says so and nothing downloads.
- Buttons are admin-only and disabled when no students are selected, matching the existing statement buttons.

## Technical notes

- Extract the existing client-side bulk logic from `src/pages/CertificatesReport.jsx` (signed URL fetch → JSZip, or jsPDF landscape image pages) into a shared helper `src/lib/bulk-certificates.js`, and use it from both places. No re-rendering of certificates and no new edge function.
- In `src/components/exams/CourseResultsView.jsx`, resolve the selected member IDs to certificates by querying `training_completions` filtered on `tenant_id`, `member_id in (...)` and the course's training type, selecting `certificate_number` and `certificate_url`.
- Include the legacy fallback already used in `MyCertificates.jsx`: if signing `certificate_url` fails and the path lacks the `tenant_id/` prefix, retry with `${tenantId}/${path}`.
- File names: `<certificate_number>.png` inside the ZIP; downloads named after the course and edition.
- No database or schema changes.
