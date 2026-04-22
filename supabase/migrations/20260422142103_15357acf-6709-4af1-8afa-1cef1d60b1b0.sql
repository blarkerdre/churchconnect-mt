-- Backfill any rows in exam_questions that have a correct_answer but no matching row in exam_question_answers
INSERT INTO public.exam_question_answers (question_id, tenant_id, correct_answer)
SELECT eq.id, eq.tenant_id, eq.correct_answer
FROM public.exam_questions eq
LEFT JOIN public.exam_question_answers eqa ON eqa.question_id = eq.id
WHERE eqa.question_id IS NULL
  AND eq.correct_answer IS NOT NULL
  AND eq.correct_answer <> ''
  AND eq.tenant_id IS NOT NULL;

-- Remove the legacy sync trigger and its function (no longer needed; app writes directly to exam_question_answers)
DROP TRIGGER IF EXISTS trg_sync_exam_question_answer ON public.exam_questions;
DROP FUNCTION IF EXISTS public.sync_exam_question_answer();

-- Drop the duplicate column from exam_questions; exam_question_answers is now the single source of truth
ALTER TABLE public.exam_questions DROP COLUMN correct_answer;