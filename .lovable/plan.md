# Fix Bible School pass rate showing 0%

## Why it happens
The Students report only counts a student as passed when they have taken every subject in the course. It counts subjects from every edition at once. In Cardiff, the course has 14 subjects in the August Edition plus 14 copies in the Unassigned edition, all switched on. So the report expects 28 subjects, no student can take 28, and nobody counts as passed. The pass rate stays at 0%.

## Fix
- Count only the subjects in the edition each student is registered for. Use the Unassigned edition only when the student has no edition.
- Match each exam a student takes to that edition's subjects, so exams in closed subjects still count.
- The pass mark, the "Completed" stage and the pass rate card then use the correct number of subjects.

Saved scores and exam data stay as they are. Only the calculation in the report changes.

## Technical notes
- `src/components/exams/StudentsReportTab.jsx`: also select `session_id` in the exam_subjects query and drop the `is_active` filter. Build `subjectsByCourseSession` keyed by `course_id|session_id ?? 'none'`. Include the registration/application `session_id` on each row and use the matching key to get `totalSubjects`. Limit `resultByKey` to those subject ids.
- No database change.
