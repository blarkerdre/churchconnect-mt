
-- 1. Trigger on exam_answers INSERT to enforce is_correct server-side
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
  FROM public.exam_questions
  WHERE id = NEW.question_id;

  IF _correct_answer IS NOT NULL THEN
    NEW.is_correct := (NEW.selected_answer = _correct_answer);
  ELSE
    NEW.is_correct := false;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_exam_answer_correctness
BEFORE INSERT OR UPDATE ON public.exam_answers
FOR EACH ROW
EXECUTE FUNCTION public.enforce_exam_answer_correctness();

-- 2. Drop the overly permissive member UPDATE policy on exam_attempts
DROP POLICY IF EXISTS "Members can update own exam attempts" ON public.exam_attempts;

-- 3. Create a restricted UPDATE policy that only allows members to update non-sensitive fields
-- Members can only update started_at (to mark start) — score, passed, certificate_issued are set by the grade-exam edge function
CREATE POLICY "Members can update own exam attempts (restricted)"
ON public.exam_attempts
FOR UPDATE
TO authenticated
USING (member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid()))
WITH CHECK (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
);

-- 4. Create a trigger to prevent members from modifying protected fields on exam_attempts
CREATE OR REPLACE FUNCTION public.protect_exam_attempt_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _is_admin boolean;
BEGIN
  -- Allow admins and service role to update anything
  SELECT public.is_admin(auth.uid()) INTO _is_admin;
  IF _is_admin OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- For regular members, prevent modification of sensitive fields
  IF OLD.score IS DISTINCT FROM NEW.score
     OR OLD.passed IS DISTINCT FROM NEW.passed
     OR OLD.certificate_issued IS DISTINCT FROM NEW.certificate_issued
     OR OLD.total_points IS DISTINCT FROM NEW.total_points
  THEN
    RAISE EXCEPTION 'You are not allowed to modify exam results';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_protect_exam_attempt_fields
BEFORE UPDATE ON public.exam_attempts
FOR EACH ROW
EXECUTE FUNCTION public.protect_exam_attempt_fields();
