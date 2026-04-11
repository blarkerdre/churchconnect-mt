

## Add Grade Classifications to Subjects

### Overview
Currently, grade classifications (Distinction, Merit, Pass) are only configurable at the **course** level. This change adds per-subject grade classifications so each subject can have its own grading scale. Subjects will default to the parent course's classifications if none are set.

### Database Migration
Add a `grade_classifications` JSONB column to `exam_subjects`:

```sql
ALTER TABLE public.exam_subjects
  ADD COLUMN grade_classifications jsonb DEFAULT NULL;
```

A `NULL` value means "inherit from the parent course." When set, it overrides the course-level classifications for that subject.

### Implementation

#### 1. SubjectManager — `src/components/exams/SubjectManager.jsx`
- Add `grade_classifications` to the form state (default `null` / empty array)
- Add a "Use custom grade bands" switch; when ON, show the same label + min_percentage editor used in the course dialog
- When OFF (default), display "Inherits from course" text
- Include `grade_classifications` in save mutation payload

#### 2. StatementOfResult — `src/components/exams/StatementOfResult.jsx`
- When computing per-subject grades, check if `subject.grade_classifications` exists; if so, use it instead of the course-level classifications

#### 3. CourseResultsView — `src/components/exams/CourseResultsView.jsx`
- Same logic: use subject-level classifications when available for per-subject grade display

#### 4. MemberExamsView (in ExamManagement.jsx)
- When displaying per-subject grade badges, use subject-level classifications if available

### Files changed
- **Migration**: Add `grade_classifications` column to `exam_subjects`
- **Edit**: `src/components/exams/SubjectManager.jsx` — add grade classification editor
- **Edit**: `src/components/exams/StatementOfResult.jsx` — use subject-level classifications
- **Edit**: `src/components/exams/CourseResultsView.jsx` — use subject-level classifications
- **Edit**: `src/pages/ExamManagement.jsx` — use subject-level classifications in member view

