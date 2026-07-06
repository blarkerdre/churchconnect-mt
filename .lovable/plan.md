## Objective
Add clear helper text beneath the "Exams Open" toggle in the Edit Course form to explain its purpose as a master switch for the entire course.

## Change
In `src/pages/ExamManagement.jsx`, line 546-549, add a `<p>` helper text element below the "Exams Open" `<Switch>` (same pattern used for "Course Pass Mark (%)"):

- Text: "When this is off, students cannot attempt any exam in this course, even if individual subjects are marked as open. Use this as a master switch to control the exam window for the entire course."

## Why
Admins currently see only a label, which is less informative than the Course Pass Mark field that now has helper text. This clarifies the difference between the course-level master switch and subject-level toggles.

## Verification
Build succeeds; toggle renders with helper text in the Edit Course dialog.