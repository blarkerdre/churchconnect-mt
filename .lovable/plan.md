

## Plan: Enhanced Exam Management — CRUD, Pass Mark, Answer Type Selection

### Overview
Enhance the Exam Management page with full exam lifecycle management: create/edit/delete exams with configurable pass marks and support for selecting the number of answer options per question (2, 3, or 4 objectives).

### 1. Database Migration

Add a `pass_mark` column to `exam_questions` table at the training-type level. Since pass marks are per training type (not per question), store them in `app_settings` using key pattern `exam_pass_mark_{type}`. The current `exam_pass_percentage` setting is already used in `TakeExamDialog` — we will make it per-training-type configurable from the Exam Management page.

No new tables needed. Add an `answer_count` column to `exam_questions` to store how many options (2/3/4) are active for each question:

```sql
ALTER TABLE public.exam_questions ADD COLUMN IF NOT EXISTS answer_count integer NOT NULL DEFAULT 4;
```

### 2. ExamManagement.jsx Changes

**Pass Mark Configuration:**
- Add a "Pass Mark" input (percentage) per training type at the top of the questions section
- Save to `app_settings` with key `exam_pass_mark_{training_type}` (e.g. `exam_pass_mark_BFC`)
- Falls back to the global `exam_pass_percentage` if not set

**Answer Type Selection (per question):**
- Add a "Number of Options" selector (2, 3, or 4) in the question form dialog
- When 2 is selected, only show A & B option inputs; when 3, show A/B/C; when 4, show all
- Store as `answer_count` on the question record
- Display only the relevant options in the questions list

**Full CRUD (already exists for questions, enhance UX):**
- Add delete confirmation dialog
- Already has create/edit/delete — ensure all work with the new `answer_count` field

### 3. TakeExamDialog.jsx Changes

- Read per-type pass mark from `app_settings` key `exam_pass_mark_{trainingType}`, falling back to global `exam_pass_percentage`
- Only render options up to `answer_count` (e.g. if `answer_count=2`, only show A and B)

### 4. Files Changed

| File | Changes |
|------|---------|
| DB migration | Add `answer_count` column to `exam_questions` |
| `ExamManagement.jsx` | Add pass mark config per type, answer count selector in question form, delete confirmation |
| `TakeExamDialog.jsx` | Use per-type pass mark, respect `answer_count` for displayed options |

### Technical Notes
- Pass marks stored per training type in `app_settings` (key: `exam_pass_mark_BFC` etc.) — no schema change needed since `app_settings` already supports arbitrary keys with jsonb values
- `answer_count` defaults to 4 so existing questions are unaffected
- The correct_answer radio buttons in the form will dynamically adjust based on the selected answer_count

