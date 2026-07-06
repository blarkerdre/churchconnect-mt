# Subject-level "exam open" gating

Currently only the course has an `exams_open` toggle. Add a per-subject toggle so students can only start/answer a subject's exam when that subject is open (and the course is open).

## Changes

1. **Migration**
   - `ALTER TABLE public.exam_subjects ADD COLUMN IF NOT EXISTS is_open boolean NOT NULL DEFAULT false;`
   - Update `start_exam_attempt` RPC (or add server-side check) to raise if the target subject's `is_open = false` or its parent course `exams_open = false`. Keeps client bypass impossible.

2. **`src/components/exams/SubjectManager.jsx`** (admin)
   - Add `is_open` to form state, an "Exams Open" `Switch` in the create/edit dialog.
   - Include `is_open` in insert/update payloads.
   - Show an "Open" / "Closed" badge on each subject row.

3. **`src/pages/ExamManagement.jsx`** (student view — the course card that lists subjects, ~line 1284)
   - When rendering each subject button:
     - Disable the "Take Exam" button when `!s.is_open`.
     - Show a small "Closed" badge/label next to closed subjects.
   - Keep the existing course-level `exams_open` gate above it unchanged.

4. **`src/components/exams/TakeExamDialog.jsx`**
   - Use existing `subjectData` query (already selects `*`) — if `subjectData.is_open === false` and not `previewMode`, show a "This exam is currently closed" state and hide the Start/Submit controls. Belt-and-braces with the server check.

## Out of scope
- Scheduling windows (open_from/open_until). Just a manual boolean.
- Changing course-level `exams_open` behaviour.
- Bulk open/close controls.

## Notes
- Default `false` so existing subjects stay closed until an admin opens them (matches the "opt-in" pattern of `exams_open`). If you'd rather default open for existing rows, say so and I'll seed them to `true` in the same migration.
