# Fix: "Error submitting exam"

## Diagnosis

The `grade-exam` edge function is failing with:

```
column "correct_answer" does not exist  (code 42703)
```

- The `correct_answer` column was moved from `public.exam_questions` to `public.exam_question_answers`.
- The current source in `supabase/functions/grade-exam/index.ts` already reads answers from `exam_question_answers` correctly.
- The **deployed** version of the function is stale — it still selects `correct_answer` from `exam_questions`, so every submission crashes at line ~91 with the 42703 error visible in the edge logs.

Nothing else references the dropped column (`rg` across `supabase/functions/` confirms only `grade-exam` mentions it, and only via `exam_question_answers`).

## Plan

1. Redeploy the `grade-exam` edge function so the current source (which reads the answer key from `exam_question_answers`) becomes active.
2. Re-submit a test exam attempt to confirm grading succeeds and no 42703 error appears in the function logs.

No code, schema, or RLS changes required.
