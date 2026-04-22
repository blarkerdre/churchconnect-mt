

## Eliminate duplicated `correct_answer` column on `exam_questions`

The exam answer key currently lives in **two** places:
- `exam_questions.correct_answer` (legacy column, exposed via the admin/leader manage policy)
- `exam_question_answers.correct_answer` (the intended hardened, admin-only home)

The grading edge function and the safe RPC already use the right sources, but the duplicate column on `exam_questions` is still readable by any admin/unit_leader and by any future view/join built on that table. Removing it closes the finding by making `exam_question_answers` the **single source of truth** for answer keys.

### Changes

#### 1. Database migration

- **Backfill** any rows in `exam_questions` that have a `correct_answer` but no matching row in `exam_question_answers`:
  ```sql
  INSERT INTO public.exam_question_answers (question_id, tenant_id, correct_answer)
  SELECT eq.id, eq.tenant_id, eq.correct_answer
  FROM public.exam_questions eq
  LEFT JOIN public.exam_question_answers eqa ON eqa.question_id = eq.id
  WHERE eqa.question_id IS NULL
    AND eq.correct_answer IS NOT NULL
    AND eq.correct_answer <> '';
  ```
- **Drop** the column:
  ```sql
  ALTER TABLE public.exam_questions DROP COLUMN correct_answer;
  ```
- The existing restrictive `Restrict exam questions to staff` policy and the permissive admin/leader policy stay as-is — they no longer protect a sensitive column, just question text and options (which is fine).

#### 2. Admin write path — `src/pages/ExamManagement.jsx`

When admins create or edit a question, the `correct_answer` value must be written to `exam_question_answers` (upsert) instead of `exam_questions`:

- Strip `correct_answer` from the `exam_questions` insert/update payload.
- After the question insert/update succeeds, upsert into `exam_question_answers`:
  ```js
  await supabase
    .from("exam_question_answers")
    .upsert(
      { question_id, tenant_id: tenantId, correct_answer },
      { onConflict: "question_id" }
    );
  ```
- When loading a question into the edit form, fetch the current correct answer from `exam_question_answers` (admin RLS already permits this) and merge it into the form state.
- When deleting a question, rely on the existing FK cascade (or add an explicit delete from `exam_question_answers` if no cascade exists — to be confirmed during implementation).

#### 3. Edge function — `supabase/functions/grade-exam/index.ts`

- Remove the `correct_answer` field from the `exam_questions` SELECT list (it no longer exists).
- The function already loads correct answers from `exam_question_answers` and attaches them onto each question — no logic change needed beyond the column removal.

#### 4. Safe RPC — `get_exam_questions_safe`

- No change required. It already omits `correct_answer` from its return signature.

#### 5. Other consumers

- `TakeExamDialog.jsx` only reads via the safe RPC — no change.
- Bulk import / question import flows (if any) need the same redirection: confirm during implementation by searching for any remaining writers of `correct_answer` to `exam_questions`.

### Acceptance checks

1. `\d exam_questions` no longer lists a `correct_answer` column.
2. Every existing question still has a corresponding `exam_question_answers` row (no answer keys lost).
3. Admin "Add question" and "Edit question" in `ExamManagement` save and reload the correct answer correctly (round-trip works).
4. Members taking an exam still see questions and options (via `get_exam_questions_safe`) and grading still produces the same scores.
5. Querying `select * from exam_questions` as an admin returns no answer-key field — the only surface for answer keys is `exam_question_answers`, which is admin/super-admin only.
6. The Lovable security finding `exam_questions_correct_answer_exposure` can be marked fixed.

### Technical notes

- The single source of truth becomes `exam_question_answers.correct_answer`. Defense-in-depth: even if a future bug exposes `exam_questions` to members, no answer keys leak.
- Backfill is safe to re-run (idempotent via the `LEFT JOIN ... WHERE NULL` guard).
- `exam_question_answers` already has tenant scoping and a restrictive admin-only policy — no RLS changes needed.

