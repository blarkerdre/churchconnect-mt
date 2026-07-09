# Fix "Edge function returned a non 2xx" on exam submit

## Root cause

The `grade-exam` edge function source is correct, but insertion into `exam_answers` fires the `enforce_exam_answer_correctness` trigger, which still reads the removed `exam_questions.correct_answer` column:

```sql
SELECT correct_answer FROM public.exam_questions WHERE id = NEW.question_id;
```

The answer key now lives in `public.exam_question_answers`. Postgres raises `column "correct_answer" does not exist`, bubbling up as the 500 seen in edge logs.

## Fix

One migration replacing the trigger function body to read from `exam_question_answers`. No frontend or edge function changes required.

```sql
CREATE OR REPLACE FUNCTION public.enforce_exam_answer_correctness()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _correct_answer text;
BEGIN
  SELECT correct_answer INTO _correct_answer
  FROM public.exam_question_answers
  WHERE question_id = NEW.question_id;

  IF _correct_answer IS NOT NULL THEN
    NEW.is_correct := (NEW.selected_answer = _correct_answer);
  ELSE
    -- Preserve is_correct computed by grade-exam edge function
    NEW.is_correct := COALESCE(NEW.is_correct, false);
  END IF;

  RETURN NEW;
END;
$$;
```

Note: the previous version overwrote `is_correct` unconditionally. The edge function already grades (including fill-in-gap case-insensitive and drag-and-drop ordered). Keeping the trigger's authoritative MCQ check but falling back to the edge function's value when no key row exists is safer.

## Verification

- Submit an exam as a member — no 500, result dialog appears.
- `exam_answers.is_correct` matches the answer key for MCQ questions.
