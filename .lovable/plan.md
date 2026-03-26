

## Fix: Exam Answers Visible to All Authenticated Users

### Problem

The `exam_questions` table has a broad SELECT policy letting any authenticated tenant member read all columns, including `correct_answer`. A member can open browser dev tools and see every answer before or during an exam.

### Current Architecture

- `TakeExamDialog.jsx` fetches questions with `select("*")` (includes `correct_answer`)
- Grading happens **client-side** — the component compares `answers[q.id]` against `q.correct_answer`
- Results are inserted into `exam_attempts` and `exam_answers` from the client

This means the client **must** have the correct answers to function. The fix requires moving grading server-side.

### Solution

**1. Database: Restrict the SELECT policy**

- Drop the existing "Authenticated can view exam questions" policy
- Add a new policy: "Admins/leaders can view all exam questions" — full access for admins and unit leaders
- Add a new policy: "Members can view exam questions without answers" — but since RLS can't filter columns, we use a **security definer function** instead

**2. Database: Create a safe question-fetching function**

```sql
CREATE FUNCTION public.get_exam_questions_safe(...)
RETURNS TABLE (id, question_text, option_a, option_b, option_c, option_d, 
               question_type, answer_count, points, sort_order, subject_id, training_type)
```

This function returns all question fields **except** `correct_answer`, and validates that the caller has tenant access.

**3. Edge Function: `grade-exam`**

A new edge function that:
- Receives `member_id`, `subject_id` or `training_type`, and `answers` (map of question_id → selected_answer)
- Fetches questions server-side (with `correct_answer`) using service role
- Grades, calculates score/percentage/pass status
- Inserts `exam_attempts` and `exam_answers` rows
- Triggers course completion check and certificate issuance
- Returns the result (score, percentage, passed, per-question correctness)

**4. Update `TakeExamDialog.jsx`**

- Fetch questions via `supabase.rpc("get_exam_questions_safe", ...)` instead of `select("*")`
- Remove all client-side grading logic
- Submit answers by invoking the `grade-exam` edge function
- Display results from the edge function response

**5. Update `ExamManagement.jsx`**

- Admin question management already uses the admin policy — no changes needed (admins/leaders retain full SELECT)

### Files Changed

- **Migration**: Drop/create RLS policies on `exam_questions`, create `get_exam_questions_safe` function
- **`supabase/functions/grade-exam/index.ts`** — new edge function for server-side grading
- **`src/components/exams/TakeExamDialog.jsx`** — use safe RPC for fetching, edge function for submission
- **`supabase/config.toml`** — add `grade-exam` function config

### What This Prevents

Members can no longer read `correct_answer` from any query path. Grading is fully server-side and tamper-proof.

