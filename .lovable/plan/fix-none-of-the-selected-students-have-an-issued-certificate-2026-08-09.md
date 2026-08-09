# Fix "none of the selected students have an issued certificate"

## What's happening

The bulk certificate download looks up certificates by matching the stored `training_type` on a completion record exactly against the course name. That match is fragile: certificate records are written with the label from the certificate template, which can differ from the course name by punctuation or code style (for example "Basic Certificate Course - BCC" versus "Basic Certificate Course (BCC)"). Any difference makes the lookup return nothing, so the message appears even when certificates exist.

Separately, in Cardiff only one certificate is currently issued for Basic Certificate Course and none for LCC/LDC, so on those courses the message is genuinely correct — but it doesn't tell the admin what to do next.

## Changes

1. Tolerant matching. Fetch the selected students' completion records for the tenant without filtering on the exact course name, then match in code using the same rules the server already uses for certificate templates: exact name, then a normalised comparison (case and punctuation insensitive), then the course code in brackets or as a word. This mirrors `certificate-template-lookup.js` / `_shared/certificate-template.ts`.

2. Clearer, actionable message. When nothing matches, distinguish the two cases:
   - No completion records at all for the selected students on this course: "No certificates issued yet — use Preview & Send or Issue certificate first."
   - Records exist but have no stored file: "N student(s) have a certificate record but no stored file."
   The message also names how many of the selected students were skipped.

3. Same tolerant matching applied to the per-student certificate actions in the course results row menu, so a single download behaves consistently with the bulk one.

## Technical notes

- Extract the normalisation/code-matching helpers from `src/lib/certificate-template-lookup.js` (or add a small shared `matchesTrainingType(a, b, code)` there) and use them in `src/components/exams/CourseResultsView.jsx`.
- Query: `training_completions` filtered on `tenant_id` and `member_id in (...)`, selecting `member_id, training_type, certificate_number, certificate_url`; filter by course in JS.
- No database or schema changes.
