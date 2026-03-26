
-- 1. Drop the broad SELECT policy that exposes correct_answer to all members
DROP POLICY IF EXISTS "Authenticated can view exam questions" ON public.exam_questions;

-- 2. Create safe question-fetching function (excludes correct_answer)
CREATE OR REPLACE FUNCTION public.get_exam_questions_safe(
  _subject_id uuid DEFAULT NULL,
  _training_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  question_text text,
  option_a text,
  option_b text,
  option_c text,
  option_d text,
  question_type text,
  answer_count integer,
  points integer,
  sort_order integer,
  subject_id uuid,
  training_type text,
  tenant_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    eq.id, eq.question_text, eq.option_a, eq.option_b, eq.option_c, eq.option_d,
    eq.question_type, eq.answer_count, eq.points, eq.sort_order,
    eq.subject_id, eq.training_type, eq.tenant_id
  FROM public.exam_questions eq
  WHERE
    user_has_tenant_access(eq.tenant_id)
    AND (
      (_subject_id IS NOT NULL AND eq.subject_id = _subject_id)
      OR (_subject_id IS NULL AND _training_type IS NOT NULL AND eq.training_type = _training_type)
    )
  ORDER BY eq.sort_order, eq.created_at;
$$;
