

## Statement of Result + Grade Classification

### Problem
There is no way to generate or view a formal "Statement of Result" for a course, and results are only labelled "Passed" or "Failed" — there is no grade classification (Pass, Merit, Distinction, etc.).

### Solution

#### 1. Database — Add configurable grade classification thresholds per course
Add a new column `grade_classifications` (JSONB) to `exam_titles` to store admin-configurable grade bands.

**Migration:**
```sql
ALTER TABLE public.exam_titles
ADD COLUMN grade_classifications jsonb
DEFAULT '[{"label":"Distinction","min_percentage":75},{"label":"Merit","min_percentage":65},{"label":"Pass","min_percentage":50}]'::jsonb;
```

Default bands: Distinction (>=75%), Merit (>=65%), Pass (>=50%). Admin can edit these per course.

#### 2. Course edit form — Add grade classification editor (`src/pages/ExamManagement.jsx`)
In the course create/edit dialog, add a section to manage grade bands:
- Show a small table of classification rows: Label + Min %
- Allow add/remove/edit rows
- Store in `titleForm.grade_classifications` and save to `exam_titles.grade_classifications`

#### 3. New component — `StatementOfResult` dialog (`src/components/exams/StatementOfResult.jsx`)
A dialog that displays a formal statement of result for a specific member + course:
- Header: Course name, member name, tenant logo (via `useTenant`)
- Table: Subject name | Score | Total | Percentage | Subject Grade
- Footer: Aggregate score, overall percentage, overall classification (Distinction/Merit/Pass/Fail)
- Print button and CSV download
- Subject-level grade classification based on course thresholds

#### 4. Admin view — Add "Statement" button per member in `CourseResultsView.jsx`
In the results table, add a small button per member row that opens the `StatementOfResult` dialog for that member. Only shown when member has completed all subjects.

#### 5. Member view — Add "View Statement of Result" in `MemberExamsView`
When a member has completed all subjects for a course, show a "View Statement of Result" button that opens the same dialog with their own data.

#### 6. Grade classification helper (`src/lib/grade-utils.js`)
```js
export function getGradeClassification(percentage, classifications) {
  const sorted = [...(classifications || [])].sort((a, b) => b.min_percentage - a.min_percentage);
  for (const c of sorted) {
    if (percentage >= c.min_percentage) return c.label;
  }
  return "Fail";
}
```

### Files changed
- **Database migration** — add `grade_classifications` JSONB column to `exam_titles`
- **New**: `src/lib/grade-utils.js` — grade classification helper
- **New**: `src/components/exams/StatementOfResult.jsx` — statement of result dialog
- `src/pages/ExamManagement.jsx` — add grade band editor in course form; add "View Statement" in member view; pass classifications to CourseResultsView
- `src/components/exams/CourseResultsView.jsx` — add "Statement" button per member, show classification badge instead of Pass/Fail

