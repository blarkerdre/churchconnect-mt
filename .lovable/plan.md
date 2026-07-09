## Filter, report & analyse lecturer feedback

Extend the Lecturer Feedback tab in Bible School Management with cross-lecturer filtering, an analytics summary, and CSV export. Keep all logic client-side over the existing `lecturer_ratings` rows; no schema changes.

### New component: `src/components/exams/LecturerFeedbackReport.jsx`

Rendered inside the "Lecturer Feedback" tab, above the existing `LecturerManager` card.

**Data:** one tenant-scoped query on `lecturer_ratings` joined with `lecturers(name, level)`, `members(first_name, last_name)`, `exam_titles(name)`, `exam_subjects(name)`, ordered by `created_at desc`.

**Filter bar** (all optional, combinable, client-side):
- Course (from distinct `exam_titles` on rows)
- Subject (dependent on selected course when set)
- Lecturer
- Level (BFC / BCC / LCC / LDC — distinct values on rows)
- Date range: from / to (uses `created_at`)
- Overall rating min slider (1–10)
- "Have again" answer (Yes / No / Maybe / Never / Unsure / any)
- Free-text search across student name and comments
- Reset button

**Analytics summary cards** (recomputed on filtered set):
- Total submissions
- Unique lecturers rated
- Average overall rating (1 decimal) + small trend badge (avg of last 30 days vs prior 30 days)
- % "Have again = Yes"
- % "Delivery = Clear & Simple or Interactive"
- % "Time keeping = On time or Just right"

**Breakdown views** (tabs inside the report card):
1. **By lecturer** — table: lecturer, submissions, avg rating, % have-again-yes. Sortable by any column. Click row → opens existing `LecturerFeedbackDialog` (reuse via a lifted callback, or navigate to the lecturer's Eye button behaviour by exposing `setFeedbackLecturer` — simpler: render our own read-only preview using the same OPTION_LABELS map already exported).
2. **By subject** — table: subject, course, submissions, avg rating.
3. **By course** — table: course, submissions, avg rating, % have-again-yes.
4. **Distribution** — simple horizontal bar list for each categorical question (session_description, delivery, time_keeping, class_atmosphere, test_quality, have_again) showing counts + percentages per option using OPTION_LABELS.

Use `recharts` (already in the project) only for a compact rating distribution bar chart (overall_rating 1–10 histogram) at the top of the Distribution tab. Everything else is Tailwind bars for lightness.

**Export**:
- "Export CSV" button — downloads current filtered rows with columns: date, course, subject, lecturer, level, student, overall_rating, session_description, delivery, time_keeping, class_atmosphere, test_quality, have_again, comments. Client-side blob download, filename `lecturer-feedback-YYYY-MM-DD.csv`.
- "Print report" button — opens `window.print()` after adding a `print:` class scope so only the report card prints (summary + current breakdown table).

### Small extraction

Move the `OPTION_LABELS` map out of `LecturerManager.jsx` into a new `src/lib/lecturer-feedback-options.js` and import it in both `LecturerManager.jsx` and the new report component. No behaviour change.

### Wiring

`src/pages/ExamManagement.jsx`:
- In the `TabsContent value="lecturer"`, render `<LecturerFeedbackReport />` above `<LecturerManager />`.
- Gate the report card behind admin (component itself renders inside the admin-only branch, so no extra check).

### Out of scope
- No DB migrations, no new tables, no RLS changes.
- No changes to how ratings are submitted.
- Non-admin/member view unchanged.
- No scheduled/emailed reports.

### Files
- **New** `src/components/exams/LecturerFeedbackReport.jsx`
- **New** `src/lib/lecturer-feedback-options.js`
- **Edit** `src/components/exams/LecturerManager.jsx` (import OPTION_LABELS from new lib)
- **Edit** `src/pages/ExamManagement.jsx` (mount the report in the Lecturer Feedback tab)
