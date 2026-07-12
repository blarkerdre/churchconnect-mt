# Tighten tenant scoping on Bible School components

The Bible School surfaces are already tenant-scoped almost everywhere (reads filter on `tenant_id`, inserts inject it, updates/deletes assert it). RLS also protects every affected table. Two queries deviate from the "explicit `tenant_id` on every query" rule and should be brought in line.

## Changes

1. **`src/components/exams/SubjectManager.jsx`** (list query, ~line 30)
   - The `exam_subjects` select filters only by `course_id`. Add `.eq("tenant_id", tenantId)` and gate the query with `enabled: !!tenantId` so it matches the pattern used elsewhere.

2. **`src/components/exams/QcReport.jsx`** (delete mutation, ~line 114)
   - The delete on `lecturer_qc_checks` targets a row by `id` only. Add `.eq("tenant_id", tenantId)` to the delete filter so a stray id from another tenant can never be targeted from this client.

## Out of scope

- No schema, RLS, or edge function changes — every table involved already has tenant-scoped RLS and the edge functions (`grade-exam`, `render-statement-pdf`, `issue-certificate`) already resolve tenant server-side from the member/session.
- No refactor of the many correctly-scoped queries across `ExamManagement.jsx`, `WoFBIApplicationsTab`, `WoFBIApplicationFormEditor`, `LecturerManager`, `LecturerFeedbackReport`, `RateLecturerDialog`, `QcCheckDialog`, `CourseResultsView`, `StatementOfResult`, `TakeExamDialog`.

## Verification

- Load `/t/<slug>/exam-management`, open a course's Subjects tab — list still renders.
- Create/edit/delete a QC check in the QC Report — behaviour unchanged.
