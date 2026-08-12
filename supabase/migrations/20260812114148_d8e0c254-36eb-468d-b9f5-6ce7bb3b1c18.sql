-- 1. Edition-aware syllabus
ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;

ALTER TABLE public.exam_questions
  ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;

-- 2. Frozen history snapshots
ALTER TABLE public.exam_attempts
  ADD COLUMN IF NOT EXISTS subject_snapshot jsonb;

ALTER TABLE public.exam_answers
  ADD COLUMN IF NOT EXISTS question_snapshot jsonb;

-- 3. Backfill subjects to the newest session linked to their course
UPDATE public.exam_subjects s
SET session_id = sub.session_id
FROM (
  SELECT t.id AS course_id, esc.session_id,
         row_number() OVER (PARTITION BY t.id ORDER BY es.starts_on DESC NULLS LAST, es.created_at DESC) AS rn
  FROM public.exam_session_courses esc
  JOIN public.exam_sessions es ON es.id = esc.session_id
  JOIN public.exam_titles t ON t.tenant_id = esc.tenant_id AND lower(t.name) = lower(esc.exam_title)
) sub
WHERE sub.rn = 1 AND sub.course_id = s.course_id AND s.session_id IS NULL;

UPDATE public.exam_questions q
SET session_id = s.session_id
FROM public.exam_subjects s
WHERE s.id = q.subject_id AND q.session_id IS NULL;

-- 4. Uniqueness now includes the edition
ALTER TABLE public.exam_subjects DROP CONSTRAINT IF EXISTS exam_subjects_course_id_name_key;
CREATE UNIQUE INDEX IF NOT EXISTS exam_subjects_course_session_name_key
  ON public.exam_subjects (course_id, name, COALESCE(session_id, '00000000-0000-0000-0000-000000000000'::uuid));

CREATE INDEX IF NOT EXISTS idx_exam_subjects_tenant_session_course
  ON public.exam_subjects (tenant_id, session_id, course_id);
CREATE INDEX IF NOT EXISTS idx_exam_questions_tenant_session_subject
  ON public.exam_questions (tenant_id, session_id, subject_id);

-- 5. Stamp questions with their parent subject's edition
CREATE OR REPLACE FUNCTION public.stamp_exam_question_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NULL AND NEW.subject_id IS NOT NULL THEN
    SELECT s.session_id INTO NEW.session_id FROM public.exam_subjects s WHERE s.id = NEW.subject_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_exam_question_session ON public.exam_questions;
CREATE TRIGGER trg_stamp_exam_question_session
BEFORE INSERT ON public.exam_questions
FOR EACH ROW EXECUTE FUNCTION public.stamp_exam_question_session();

-- 6. Clone a syllabus from one edition to another
CREATE OR REPLACE FUNCTION public.clone_exam_subjects_to_session(
  p_tenant_id uuid,
  p_course_id uuid,
  p_from_session uuid,
  p_to_session uuid,
  p_include_questions boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_subjects int := 0;
  v_questions int := 0;
  r record;
  v_new_id uuid;
BEGIN
  IF NOT (public.is_tenant_admin(auth.uid(), p_tenant_id)
          OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF p_to_session IS NULL THEN
    RAISE EXCEPTION 'Target edition is required';
  END IF;

  FOR r IN
    SELECT * FROM public.exam_subjects
    WHERE tenant_id = p_tenant_id
      AND course_id = p_course_id
      AND session_id IS NOT DISTINCT FROM p_from_session
    ORDER BY sort_order, created_at
  LOOP
    IF EXISTS (
      SELECT 1 FROM public.exam_subjects
      WHERE tenant_id = p_tenant_id AND course_id = p_course_id
        AND session_id = p_to_session AND name = r.name
    ) THEN
      CONTINUE;
    END IF;

    INSERT INTO public.exam_subjects (
      tenant_id, course_id, session_id, name, code, description, lecturer_id,
      pass_mark_percentage, time_limit_minutes, randomize_questions,
      grade_classifications, sort_order, is_active, is_open
    ) VALUES (
      p_tenant_id, p_course_id, p_to_session, r.name, r.code, r.description, r.lecturer_id,
      r.pass_mark_percentage, r.time_limit_minutes, r.randomize_questions,
      r.grade_classifications, r.sort_order, r.is_active, false
    )
    RETURNING id INTO v_new_id;

    v_subjects := v_subjects + 1;

    IF p_include_questions THEN
      INSERT INTO public.exam_questions (
        tenant_id, subject_id, session_id, training_type, question_text,
        option_a, option_b, option_c, option_d, points, sort_order,
        answer_count, question_type, created_by
      )
      SELECT p_tenant_id, v_new_id, p_to_session, q.training_type, q.question_text,
             q.option_a, q.option_b, q.option_c, q.option_d, q.points, q.sort_order,
             q.answer_count, q.question_type, auth.uid()
      FROM public.exam_questions q
      WHERE q.subject_id = r.id AND q.tenant_id = p_tenant_id;

      GET DIAGNOSTICS v_questions = ROW_COUNT;
    END IF;
  END LOOP;

  RETURN jsonb_build_object('subjects', v_subjects, 'questions', v_questions);
END;
$$;

REVOKE ALL ON FUNCTION public.clone_exam_subjects_to_session(uuid, uuid, uuid, uuid, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.clone_exam_subjects_to_session(uuid, uuid, uuid, uuid, boolean) TO authenticated;