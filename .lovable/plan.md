

## Plan: Admin Exam Preview + Retake with Permission

### Summary
Add two features: (1) an admin preview that renders the exam exactly as members see it, and (2) allow members to retake failed subject exams only when an admin grants permission via a retake flag.

---

### 1. Database Migration

Add a column to `exam_attempts` for admin-granted retake permission:

```sql
ALTER TABLE public.exam_attempts
  ADD COLUMN retake_allowed BOOLEAN NOT NULL DEFAULT false;
```

This flag lets admins mark a failed attempt as "retake allowed", re-enabling the subject button for that member.

---

### 2. Admin Exam Preview

**`src/pages/ExamManagement.jsx`**
- Add a "Preview Exam" button next to each subject (visible when a subject is selected and has questions)
- Clicking it opens `TakeExamDialog` in a **preview mode** — a new `previewMode` prop
- In preview mode: no submission occurs, timer runs but doesn't auto-submit, a "Preview Mode" banner is shown, and the Submit button is replaced with "Close Preview"

**`src/components/exams/TakeExamDialog.jsx`**
- Accept a new `previewMode` prop (default `false`)
- When `previewMode=true`:
  - Show a banner: "Preview Mode — This is how members will see the exam"
  - Disable the submit mutation entirely
  - Replace "Submit Exam" with "Close Preview"
  - Timer displays but does not auto-submit
  - Questions load and shuffle per subject settings as normal

---

### 3. Member Retake for Failed Subjects

**`src/pages/MyProfile.jsx` — `DynamicExamButtons`**
- Currently `disabled={taken}` prevents all retakes
- Change logic: disable only if the member **passed** OR if they failed but no `retake_allowed=true` attempt exists
- If a failed attempt has `retake_allowed=true`, enable the button with a "Retake" label
- After a retake, the system keeps the best score (existing logic already does this via `bestBySubject`)

**`src/components/exams/CourseResultsView.jsx`**
- Add a "Allow Retake" button next to each failed member-subject result
- Clicking it sets `retake_allowed=true` on that member's latest failed attempt for the subject
- Show visual indicator when retake has been granted

**`src/components/exams/TakeExamDialog.jsx`**
- On successful retake submission, reset `retake_allowed=false` on the attempt (or the new attempt is created fresh, so no change needed — the old attempt's flag is consumed)

---

### Technical Details

**Files Modified:**
- `src/pages/ExamManagement.jsx` — add Preview button, pass previewMode to TakeExamDialog
- `src/components/exams/TakeExamDialog.jsx` — add previewMode prop with banner and disabled submit
- `src/pages/MyProfile.jsx` — update DynamicExamButtons retake logic
- `src/components/exams/CourseResultsView.jsx` — add "Allow Retake" admin action

**Migration SQL:**
```sql
ALTER TABLE public.exam_attempts
  ADD COLUMN retake_allowed BOOLEAN NOT NULL DEFAULT false;
```

**Retake Logic Flow:**
```text
Member fails subject exam
  → Admin sees failed result in Course Results
  → Admin clicks "Allow Retake" → sets retake_allowed=true on attempt
  → Member sees "Retake" button enabled on their profile
  → Member takes exam again → new attempt created
  → Best score across all attempts is kept for aggregation
```

