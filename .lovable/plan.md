

## Plan: Certificate Course → Subjects Hierarchy with Aggregate Scoring

### Overview
Restructure the exam system from flat exam titles into a two-level hierarchy: **Certificate Courses** (e.g., BCC) contain multiple **Subjects** (e.g., "Church History", "Doctrine"). Each subject has its own exam with questions. A member's aggregate score across all subjects determines whether they pass the course and receive a certificate. Admins can CRUD both courses and subjects. Members can download a score report.

---

### 1. Database Migration

**Add columns to `exam_titles`** (which becomes the "course" level):
```sql
ALTER TABLE public.exam_titles 
  ADD COLUMN IF NOT EXISTS pass_mark_percentage numeric NOT NULL DEFAULT 50;
```

**New table: `exam_subjects`**
```sql
CREATE TABLE public.exam_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id uuid REFERENCES public.exam_titles(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  description text,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(course_id, name)
);
ALTER TABLE public.exam_subjects ENABLE ROW LEVEL SECURITY;
-- Admins manage, authenticated view
```

**Add `subject_id` to `exam_questions`:**
```sql
ALTER TABLE public.exam_questions 
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE CASCADE;
```
Questions will be linked to subjects. `training_type` is kept for backward compatibility but new questions use `subject_id`.

**Add `subject_id` to `exam_attempts`:**
```sql
ALTER TABLE public.exam_attempts 
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.exam_subjects(id);
```

---

### 2. ExamManagement.jsx — Full Restructure

**Course Management** (existing exam titles section, enhanced):
- Add `pass_mark_percentage` input when creating/editing a course
- Show course-level aggregate pass mark

**Subject Management** — new section per course:
- When a course is selected, show its subjects list
- CRUD subjects: name, description, sort order
- Delete with confirmation

**Question Management** — scoped to a subject:
- When a subject is selected within a course, show/manage its questions (existing question CRUD, just scoped to subject instead of training_type)
- Questions saved with both `training_type` (course name) and `subject_id`

**Course Results View**:
- Per course, show members who have taken exams with per-subject scores and aggregate
- Pass/fail badge based on course `pass_mark_percentage`

---

### 3. TakeExamDialog.jsx Changes

- Accept `subjectId` and `subjectName` props alongside `trainingType`
- Fetch questions by `subject_id` instead of `training_type`
- Save attempt with `subject_id` and `training_type` (course name)
- After completing a subject exam, check if all subjects in the course are done; if aggregate meets pass mark, trigger certificate issuance

---

### 4. MyProfile.jsx — Member View

- Replace flat exam buttons with course → subject hierarchy
- Show course card with list of subjects; each subject has a "Take Exam" button
- Show per-subject scores and aggregate progress
- Add "Download Score Report" button that generates a printable HTML view of all subject scores for a course
- After all subjects completed and aggregate passes, show certificate

---

### 5. Files Changed

| File | Changes |
|------|---------|
| DB migration | Add `pass_mark_percentage` to `exam_titles`, create `exam_subjects`, add `subject_id` to `exam_questions` and `exam_attempts` |
| `ExamManagement.jsx` | Course pass mark config, subject CRUD within courses, scope questions to subjects, course-level results |
| `TakeExamDialog.jsx` | Accept `subjectId`, fetch questions by subject, save with subject reference, check course completion |
| `MyProfile.jsx` | Course → subject hierarchy UI, per-subject scores, downloadable score report, aggregate progress |
| `ExamSessionManager.jsx` | Update to work with course/subject model (sessions assign courses, aggregate at course level) |

### Technical Notes
- `subject_id` is nullable on `exam_questions` and `exam_attempts` for backward compatibility with existing data
- Pass mark moves from `app_settings` to `exam_titles.pass_mark_percentage` (simpler, co-located)
- Score report download: generate a print-friendly HTML window (same pattern as `PrintReportButton`) showing all subject scores, aggregate, and pass/fail status
- Certificate auto-issuance triggers when aggregate across all active subjects in a course meets the pass mark

