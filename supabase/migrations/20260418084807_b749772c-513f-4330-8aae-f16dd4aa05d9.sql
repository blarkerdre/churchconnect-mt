
-- ============================================================
-- Restrict exam_questions.correct_answer to admins only
-- ============================================================

-- 1. Create admin-only answer key table
CREATE TABLE IF NOT EXISTS public.exam_question_answers (
  question_id uuid PRIMARY KEY REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  correct_answer text NOT NULL,
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_question_answers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage answer keys" ON public.exam_question_answers;
CREATE POLICY "Admins manage answer keys"
ON public.exam_question_answers FOR ALL TO authenticated
USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role))
WITH CHECK (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role));

-- 2. Backfill existing answers
INSERT INTO public.exam_question_answers (question_id, correct_answer, tenant_id)
SELECT id, correct_answer, tenant_id
FROM public.exam_questions
WHERE correct_answer IS NOT NULL AND tenant_id IS NOT NULL
ON CONFLICT (question_id) DO UPDATE SET
  correct_answer = EXCLUDED.correct_answer,
  updated_at = now();

-- 3. Sync trigger: mirror correct_answer writes into the answer-key table
CREATE OR REPLACE FUNCTION public.sync_exam_question_answer()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.correct_answer IS NOT NULL AND NEW.tenant_id IS NOT NULL THEN
    INSERT INTO public.exam_question_answers (question_id, correct_answer, tenant_id, updated_at)
    VALUES (NEW.id, NEW.correct_answer, NEW.tenant_id, now())
    ON CONFLICT (question_id) DO UPDATE SET
      correct_answer = EXCLUDED.correct_answer,
      tenant_id = EXCLUDED.tenant_id,
      updated_at = now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_exam_question_answer ON public.exam_questions;
CREATE TRIGGER trg_sync_exam_question_answer
AFTER INSERT OR UPDATE OF correct_answer, tenant_id ON public.exam_questions
FOR EACH ROW EXECUTE FUNCTION public.sync_exam_question_answer();

-- 4. Revoke column-level SELECT on correct_answer from authenticated/anon
-- This blocks unit leaders from reading the answer key directly via exam_questions.
-- Admins read it via the new exam_question_answers table; the grade-exam edge
-- function uses service role and is unaffected by these grants.
REVOKE SELECT (correct_answer) ON public.exam_questions FROM authenticated;
REVOKE SELECT (correct_answer) ON public.exam_questions FROM anon;

-- Re-grant SELECT on all other columns to keep existing UX intact.
GRANT SELECT (
  id, training_type, subject_id, question_text, question_type,
  option_a, option_b, option_c, option_d,
  answer_count, points, sort_order, created_by, created_at, tenant_id
) ON public.exam_questions TO authenticated;

-- 5. Admin-facing RPC to fetch full question data (incl. correct_answer)
-- Used by ExamManagement.jsx so admins can still edit questions.
CREATE OR REPLACE FUNCTION public.get_exam_questions_with_answers(
  _tenant_id uuid,
  _subject_id uuid DEFAULT NULL,
  _training_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  training_type text,
  subject_id uuid,
  question_text text,
  question_type text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  correct_answer text,
  answer_count integer,
  points integer,
  sort_order integer,
  tenant_id uuid,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (is_admin(auth.uid(), _tenant_id) OR has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Access denied: admin role required';
  END IF;

  RETURN QUERY
  SELECT q.id, q.training_type, q.subject_id, q.question_text, q.question_type,
         q.option_a, q.option_b, q.option_c, q.option_d,
         a.correct_answer, q.answer_count, q.points, q.sort_order,
         q.tenant_id, q.created_at
  FROM public.exam_questions q
  LEFT JOIN public.exam_question_answers a ON a.question_id = q.id
  WHERE q.tenant_id = _tenant_id
    AND (_subject_id IS NULL OR q.subject_id = _subject_id)
    AND (_training_type IS NULL OR q.training_type = _training_type)
  ORDER BY q.sort_order, q.created_at;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_exam_questions_with_answers(uuid, uuid, text) TO authenticated;
