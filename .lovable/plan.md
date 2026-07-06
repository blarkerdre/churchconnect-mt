## Goal
Print the exam grade classification (e.g. Distinction / Merit / Pass) on Bible School student certificates automatically, based on the student's aggregated exam results for that course.

## Current state
- The certificate SVG for Bible School courses already renders a "with <grade>" line when `gradeClassification` is present (edge function `issue-certificate/index.ts` line 358–362).
- `gradeClassification` currently comes only from an explicit `grade_classification` in the request body or from an existing `training_completions.grade_classification` row.
- No caller (`IssueCertificateDialog`, `CertificateApprovals`) passes it, and it isn't computed anywhere, so the grade line never appears on freshly issued certificates.
- The grade bands live on `exam_titles.grade_classifications`; the aggregation logic used in the UI is in `CourseResultsView` / `StatementOfResult` + `src/lib/grade-utils.js`.

## Change
Compute the grade inside the `issue-certificate` edge function when the training type is a Bible School course, then store it on the completion row and render it on the certificate. No frontend caller changes needed; approvals, manual issuance, reissues and previews all benefit.

Scope: Bible School courses only (matches the existing `isBibleSchool` layout that already renders the grade line). Other training types are unchanged.

## Technical details
Edit `supabase/functions/issue-certificate/index.ts`:

1. Extend the `exam_titles` lookup (already present at line 244) to also select `pass_mark_percentage` and `grade_classifications`.
2. Add a helper that, for a given `member_id` + course:
   - Loads active `exam_subjects` for the course (id + `grade_classifications` for per-subject overrides — kept for future, but overall grade uses the course bands like `CourseResultsView`).
   - Loads that member's `exam_attempts` for those subject ids.
   - For each subject, picks the member's best attempt by percentage (same logic as `CourseResultsView`).
   - Sums `score` and `total_points` across subjects; computes `percentage = totalScore / totalPoints * 100`.
   - Returns `{ percentage, hasResults, passed, allSubjectsTaken }`.
3. Port `getGradeClassification` from `src/lib/grade-utils.js` into the edge function (small pure function) to avoid a cross-package import.
4. When `isBibleSchool` and `gradeClassification` is still empty after the existing fallback chain, compute it:
   - If the member has attempts for **all** active subjects and `percentage >= course.pass_mark_percentage`, set `gradeClassification` to the classification label.
   - Otherwise leave it empty (do not print a misleading grade or "Fail" — matches the current "no grade line" behaviour).
5. Keep the existing `grade_classification` write-through to `training_completions` (lines 528 & 549) so reissues remain stable and admin overrides via `existing.grade_classification` still win.
6. Preview mode (`isPreview`) uses the same computed grade so what admins see matches what gets issued.

No DB migration required — `exam_titles.grade_classifications` and `training_completions.grade_classification` already exist.

## Out of scope
- Backfilling grades for certificates already issued (existing rows keep whatever `grade_classification` they have; a manual reissue will recompute).
- Custom placement / styling of the grade line on non-Bible-School certificate layouts.
- Per-subject grade breakdown on the certificate (course-level classification only).
