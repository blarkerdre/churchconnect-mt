

## Plan: Dynamic Exam Types, Question Type Modes, and Exam Title CRUD

### Overview
Three enhancements: (1) Replace hardcoded training types with a dynamic `exam_titles` table so admins can create/edit/delete exam categories, (2) Add question type support for "multiple_choice", "fill_in_gap", and "drag_and_drop" beyond the current MCQ-only mode, (3) Update the member-facing TakeExamDialog to render each question type correctly.

---

### 1. Database Migration

**New table: `exam_titles`** — replaces the hardcoded `EXAM_TRAINING_TYPES` array:
```sql
CREATE TABLE public.exam_titles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.exam_titles ENABLE ROW LEVEL SECURITY;
-- Admins can manage, authenticated can view
```

Seed with existing types: `INSERT INTO exam_titles (name) VALUES ('BFC'),('BCC'),('LCC'),('LDC');`

**Add `question_type` column to `exam_questions`:**
```sql
ALTER TABLE public.exam_questions 
  ADD COLUMN IF NOT EXISTS question_type text NOT NULL DEFAULT 'multiple_choice';
```
Values: `multiple_choice`, `fill_in_gap`, `drag_and_drop`.

For `fill_in_gap`: the `correct_answer` column stores the expected text answer (case-insensitive matching). Options A-D are unused.

For `drag_and_drop`: options A-D store the items to order. `correct_answer` stores the correct order as comma-separated letters (e.g. `"b,a,d,c"`).

---

### 2. ExamManagement.jsx Changes

**Exam Titles Management Section:**
- Add a card at the top with a list of exam titles from `exam_titles` table
- Add/Edit/Delete exam title buttons with inline form or small dialog
- Replace `EXAM_TRAINING_TYPES` hardcoded array with data from `exam_titles` query
- The training type selector dropdown uses this dynamic list

**Question Type Selector:**
- In the question form dialog, add a "Question Type" select: Multiple Choice, Fill in the Gap, Drag & Drop
- **Multiple Choice**: current behavior (options + correct answer radio)
- **Fill in the Gap**: show only question text + a "Correct Answer" text input (no options A-D)
- **Drag & Drop**: show items (options A-D) + correct order input (comma-separated or drag UI in admin is just text input for the correct order sequence)

---

### 3. TakeExamDialog.jsx Changes

**Multiple Choice**: unchanged — radio buttons for options.

**Fill in the Gap**: render a text input. On submit, compare `trim().toLowerCase()` to `correct_answer.trim().toLowerCase()`.

**Drag & Drop**: render the options as draggable items. User reorders them. On submit, compare the order string to `correct_answer`. Use a simple up/down button reorder UI (no complex DnD library needed).

---

### 4. Files Changed

| File | Changes |
|------|---------|
| DB migration | Create `exam_titles` table + seed, add `question_type` to `exam_questions` |
| `ExamManagement.jsx` | Dynamic exam titles CRUD, question type selector in form, conditional form fields |
| `TakeExamDialog.jsx` | Render fill_in_gap (text input) and drag_and_drop (reorder UI) question types |
| `MyProfile.jsx` | Fetch exam titles dynamically instead of hardcoded list |

