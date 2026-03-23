

## Plan: Exam System Overhaul

### Summary
Remove the Exam Sessions feature entirely, add subject-level pass marks, time limits, question randomization, downloadable CSV results, admin exam preview, and permission-based retakes.

---

### Completed Features

#### Subject-level pass marks, time limits, randomization ✅
- Added `pass_mark_percentage`, `time_limit_minutes`, `randomize_questions` to `exam_subjects`
- Countdown timer with auto-submit in TakeExamDialog
- Fisher-Yates shuffle when `randomize_questions = true`

#### CSV Downloads ✅
- Course-level and per-subject CSV downloads in CourseResultsView

#### Admin Exam Preview ✅
- "Preview Exam" button in ExamManagement when a subject has questions
- Opens TakeExamDialog in `previewMode` — banner shown, no submission, timer doesn't auto-submit

#### Permission-based Retakes ✅
- `retake_allowed` boolean column on `exam_attempts`
- Admins click "Retake [Subject]" in Course Results to grant permission
- Members see "↻ Retake" button on their profile when allowed
- Best score across all attempts is kept for aggregation
