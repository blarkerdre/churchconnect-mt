
-- Auto-link member by email function
CREATE OR REPLACE FUNCTION public.auto_link_member_by_email(_user_id uuid, _email text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _member_id uuid;
  _match_count integer;
BEGIN
  IF _user_id IS NULL OR _email IS NULL THEN
    RETURN NULL;
  END IF;

  -- Check if user already has a linked member
  SELECT id INTO _member_id FROM public.members WHERE user_id = _user_id LIMIT 1;
  IF _member_id IS NOT NULL THEN
    RETURN _member_id;
  END IF;

  -- Find unlinked member by email
  SELECT count(*), min(id)
  INTO _match_count, _member_id
  FROM public.members
  WHERE lower(email) = lower(_email)
    AND user_id IS NULL;

  -- Only auto-link if exactly one match
  IF _match_count = 1 AND _member_id IS NOT NULL THEN
    UPDATE public.members
    SET user_id = _user_id, updated_at = now()
    WHERE id = _member_id AND user_id IS NULL;
    RETURN _member_id;
  END IF;

  RETURN NULL;
END;
$$;

-- Exam questions table
CREATE TABLE public.exam_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  training_type text NOT NULL,
  question_text text NOT NULL,
  option_a text NOT NULL,
  option_b text NOT NULL,
  option_c text NOT NULL,
  option_d text NOT NULL,
  correct_answer char(1) NOT NULL,
  points integer NOT NULL DEFAULT 1,
  sort_order integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_questions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can manage exam questions" ON public.exam_questions
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Authenticated can view exam questions" ON public.exam_questions
  FOR SELECT TO authenticated
  USING (true);

-- Exam attempts table
CREATE TABLE public.exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  training_type text NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  score integer DEFAULT 0,
  total_points integer DEFAULT 0,
  passed boolean DEFAULT false,
  certificate_issued boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can view all exam attempts" ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Admins/leaders can manage exam attempts" ON public.exam_attempts
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Members can view own exam attempts" ON public.exam_attempts
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert own exam attempts" ON public.exam_attempts
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Members can update own exam attempts" ON public.exam_attempts
  FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM members m WHERE m.id = exam_attempts.member_id AND m.user_id = auth.uid()
  ));

-- Exam answers table
CREATE TABLE public.exam_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id uuid NOT NULL REFERENCES public.exam_attempts(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.exam_questions(id) ON DELETE CASCADE,
  selected_answer char(1),
  is_correct boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.exam_answers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can view all exam answers" ON public.exam_answers
  FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Admins/leaders can manage exam answers" ON public.exam_answers
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Members can view own exam answers" ON public.exam_answers
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM exam_attempts ea
    JOIN members m ON m.id = ea.member_id
    WHERE ea.id = exam_answers.attempt_id AND m.user_id = auth.uid()
  ));

CREATE POLICY "Members can insert own exam answers" ON public.exam_answers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM exam_attempts ea
    JOIN members m ON m.id = ea.member_id
    WHERE ea.id = exam_answers.attempt_id AND m.user_id = auth.uid()
  ));
