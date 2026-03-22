

## Plan: Auto-Link Accounts + Training Exams with Certificate Generation

### 1. Auto-Link User and Member Accounts

The current system uses `claim_own_member_profile` RPC (matching by email) which is called on login. This works but only links if emails match exactly. 

**Improvements:**
- **On signup**: Update `admin-create-user` edge function to auto-link existing unlinked member records by email when creating a user (if no `member_data` is provided)
- **On public registration**: Update `public-register` edge function — when an authenticated user submits, auto-set `user_id` on the member record (already partially done, but ensure it also checks for existing unlinked members with matching email)
- **On login (existing)**: The `claim_own_member_profile` RPC already handles this — no changes needed
- **Admin UI**: In `MemberFormDialog.jsx`, add a one-click "Link Account" button that searches for existing users by the member's email and links them automatically (using service role via a small edge function or RPC)

**Database migration:**
```sql
CREATE OR REPLACE FUNCTION public.auto_link_member_by_email(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ ... $$;
```
This function finds a single unlinked member by email and sets `user_id`. Called from `admin-create-user` when no `member_data` is provided.

**Files:** `admin-create-user/index.ts`, DB migration

---

### 2. Training Exams System

Create a full exam/quiz system for training programs (BFC, BCC, LCC, LDC). Admins create questions, members answer them, answers are auto-marked, and certificates are generated on passing.

**Database migration — new tables:**

| Table | Columns |
|-------|---------|
| `exam_questions` | id, training_type, question_text, option_a, option_b, option_c, option_d, correct_answer (a/b/c/d), points (int, default 1), sort_order, created_by, created_at |
| `exam_attempts` | id, member_id, training_type, started_at, completed_at, score, total_points, passed (bool), certificate_issued (bool) |
| `exam_answers` | id, attempt_id, question_id, selected_answer, is_correct (bool) |

**App setting:** `exam_pass_percentage` (default 70) stored in `app_settings`.

**RLS:**
- `exam_questions`: Admins/leaders can manage; authenticated can SELECT
- `exam_attempts`: Admins/leaders can view all; members can view/insert own
- `exam_answers`: Same as attempts

**Admin UI — Exam Management (new page or section in Settings):**
- Create/edit/delete multiple-choice questions per training type
- Set correct answer, reorder questions
- Configure pass percentage

**Member UI — Take Exam (in MyProfile or new page):**
- Select training type → see questions one by one or all at once
- Submit answers → auto-mark (compare `selected_answer` to `correct_answer`)
- Calculate score → if >= pass percentage, mark as passed
- On pass: auto-call `issue-certificate` edge function to generate and email certificate
- On fail: show score and allow retry

**Admin UI — View Results:**
- In `TrainingReports.jsx` or `MemberFormDialog.jsx`, show exam history per member
- View individual attempt details (which questions were right/wrong)

---

### 3. Files Changed Summary

| File | Changes |
|------|---------|
| DB migration | `auto_link_member_by_email` RPC, `exam_questions`, `exam_attempts`, `exam_answers` tables with RLS |
| `admin-create-user/index.ts` | Auto-link existing member by email when no `member_data` provided |
| New: `src/pages/ExamManagement.jsx` | Admin page to manage exam questions per training type |
| New: `src/components/exams/TakeExamDialog.jsx` | Member-facing exam UI with auto-marking |
| New: `src/components/exams/ExamResultsPanel.jsx` | View exam attempt results |
| `src/pages/MyProfile.jsx` | Add "Take Exam" buttons for available training types |
| `src/pages/TrainingReports.jsx` | Remove WIT, add link to exam results |
| `src/App.jsx` | Add route for exam management page |
| `src/components/AppLayout.jsx` | Add nav link for exam management (admin only) |

### Technical Notes
- Exam auto-marking is done client-side by comparing answers to `correct_answer` from the questions table, then the results are stored in `exam_attempts`/`exam_answers`
- Certificate generation reuses the existing `issue-certificate` edge function
- Pass/fail threshold is configurable via `app_settings`
- Members can retake exams (new attempt each time)
- The auto-link function handles edge cases: multiple members with same email returns null (no auto-link), single match auto-links

