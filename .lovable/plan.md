

## Plan: Exam Sessions with Aggregate Scoring Across 10+ Course Exams

### Overview
Add an exam session system where admins create sessions containing multiple course exams (10+). Members take all assigned exams within a session. The system calculates an aggregate score across all exams and determines pass/fail based on admin-configured criteria.

### 1. Database Migration

**New table: `exam_sessions`**
```sql
CREATE TABLE public.exam_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',  -- draft, active, closed
  pass_mark_percentage numeric NOT NULL DEFAULT 50,
  started_at timestamptz,
  ended_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
```

**New table: `exam_session_courses`** — links which exam titles are included in a session:
```sql
CREATE TABLE public.exam_session_courses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES public.exam_sessions(id) ON DELETE CASCADE NOT NULL,
  exam_title text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  UNIQUE(session_id, exam_title)
);
```

**Add `session_id` to `exam_attempts`:**
```sql
ALTER TABLE public.exam_attempts 
ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id);
```

RLS: Admins can manage; authenticated can view active sessions.

### 2. ExamManagement.jsx — Session Management Section

**New "Exam Sessions" tab/card:**
- Create session: name, description, select which exam titles to include (multi-select from `exam_titles`), set aggregate pass mark percentage
- Start/Stop session buttons (toggle `active`/`closed`)
- Only one session can be active at a time (enforced in UI)
- View session details: list of included courses, session status

**Aggregate Results View** — when viewing a closed/active session:
- Query `exam_attempts` WHERE `session_id = X`, grouped by `member_id`
- Per member row: name, score per course exam, total aggregate score, total possible points, aggregate percentage, pass/fail badge
- Summary: average aggregate, overall pass rate, participant count

### 3. TakeExamDialog.jsx Changes
- Accept `sessionId` prop
- Include `session_id` in `exam_attempts` insert
- Backward compatible: `session_id` is nullable

### 4. MyProfile.jsx Changes
- Show active session with its list of required exams
- Track which exams the member has already taken in this session
- Show aggregate progress (e.g., "4/10 exams completed, current aggregate: 72%")
- Pass `sessionId` to `TakeExamDialog`

### 5. Files Changed

| File | Changes |
|------|---------|
| DB migration | Create `exam_sessions`, `exam_session_courses` tables; add `session_id` to `exam_attempts` |
| `ExamManagement.jsx` | Session CRUD (create/edit/delete/start/stop), course selection, aggregate results table |
| `TakeExamDialog.jsx` | Accept and store `session_id` |
| `MyProfile.jsx` | Show active session, track exam progress, show aggregate score |

### Technical Notes
- `exam_session_courses` allows flexible assignment of 1-10+ exam titles per session
- Aggregate = sum of all attempt scores / sum of all attempt total_points across the session for a member
- Pass/fail determined by comparing aggregate percentage against `exam_sessions.pass_mark_percentage`
- Members can only take each exam title once per session (enforced in UI by checking existing attempts)
- `selected_answer` column on `exam_answers` needs to accept text (not just char) for fill_in_gap and drag_and_drop — will alter if needed

