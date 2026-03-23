

## Plan: Exam System Overhaul

### Summary
Remove the Exam Sessions feature entirely, add subject-level pass marks, time limits, question randomization, and downloadable CSV results.

---

### 1. Database Migration

Add new columns to `exam_subjects`:
- `pass_mark_percentage NUMERIC NOT NULL DEFAULT 50` — per-subject pass mark
- `time_limit_minutes INTEGER DEFAULT NULL` — optional time limit
- `randomize_questions BOOLEAN NOT NULL DEFAULT false` — shuffle question order

No changes to `exam_sessions` or `exam_session_courses` tables (keep them but stop using them in the UI to avoid breaking existing data references in `exam_attempts.session_id`).

---

### 2. Remove Exam Sessions from UI

**`src/pages/ExamManagement.jsx`**
- Remove the `<ExamSessionManager />` import and render (line 18, 234)
- Remove `ExamSessionManager` import

**`src/components/exams/ExamSessionManager.jsx`**
- Keep file but it will no longer be imported (or delete it)

**`src/pages/MyProfile.jsx` / `DynamicExamButtons`**
- Remove `sessionId` from `onSelect` calls and `TakeExamDialog` props

**`src/components/exams/TakeExamDialog.jsx`**
- Remove `sessionId` prop usage; stop writing `session_id` to `exam_attempts`

---

### 3. Subject-Level Pass Mark

**`src/components/exams/SubjectManager.jsx`**
- Add `pass_mark_percentage` field to the subject add/edit form dialog
- Display pass mark badge on each subject row

**`src/components/exams/TakeExamDialog.jsx`**
- Fetch subject's `pass_mark_percentage` instead of course-level one when taking a subject exam
- Use subject pass mark to determine pass/fail for individual subject attempts

**`src/pages/MyProfile.jsx` / `DynamicExamButtons`**
- Show subject-level pass/fail status based on subject pass mark

---

### 4. Time Limit with Countdown Timer

**`src/components/exams/SubjectManager.jsx`**
- Add `time_limit_minutes` field (optional number input) to subject form

**`src/components/exams/TakeExamDialog.jsx`**
- On exam open, if subject has a time limit, start a countdown timer
- Display a prominent countdown (mm:ss) at the top of the exam
- Auto-submit when timer reaches zero
- Visual warning (color change) when < 2 minutes remain

---

### 5. Question Randomization

**`src/components/exams/SubjectManager.jsx`**
- Add `randomize_questions` toggle (Switch) to subject form

**`src/components/exams/TakeExamDialog.jsx`**
- After fetching questions, if subject has `randomize_questions = true`, shuffle the array using Fisher-Yates before rendering

---

### 6. Downloadable CSV Results

**`src/components/exams/CourseResultsView.jsx`**
- Add "Download CSV" button alongside existing "Print Results"
- Generate CSV with columns: Member, [Subject1], [Subject2], ..., Total, %, Status
- For subject-level download: separate button per subject with Member, Score, Total, %, Pass/Fail

**`src/pages/ExamManagement.jsx`**
- Add a "Download Subject Results" button when a subject is selected, showing per-member results for that specific subject as CSV

---

### Technical Details

**Files Modified:**
- `src/pages/ExamManagement.jsx` — remove session manager, add subject CSV download
- `src/components/exams/SubjectManager.jsx` — add pass_mark, time_limit, randomize fields
- `src/components/exams/TakeExamDialog.jsx` — countdown timer, randomization, remove session_id
- `src/components/exams/CourseResultsView.jsx` — add CSV download
- `src/pages/MyProfile.jsx` — remove sessionId references, show subject pass marks

**Migration SQL:**
```sql
ALTER TABLE public.exam_subjects
  ADD COLUMN pass_mark_percentage NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN time_limit_minutes INTEGER DEFAULT NULL,
  ADD COLUMN randomize_questions BOOLEAN NOT NULL DEFAULT false;
```

