
-- Guard 1: block course_registrations referencing closed/non-existent sessions
CREATE OR REPLACE FUNCTION public.enforce_course_registration_session()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  s_status TEXT;
  s_tenant UUID;
BEGIN
  IF NEW.session_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT status, tenant_id INTO s_status, s_tenant
  FROM public.exam_sessions
  WHERE id = NEW.session_id;

  IF s_status IS NULL THEN
    RAISE EXCEPTION 'Exam session not found';
  END IF;
  IF s_tenant <> NEW.tenant_id THEN
    RAISE EXCEPTION 'Exam session belongs to a different tenant';
  END IF;
  IF s_status NOT IN ('draft', 'active') THEN
    RAISE EXCEPTION 'Cannot register for a session that is %', s_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_course_registration_session ON public.course_registrations;
CREATE TRIGGER trg_enforce_course_registration_session
BEFORE INSERT ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.enforce_course_registration_session();

-- Guard 2: block exam_attempts unless session-eligible
CREATE OR REPLACE FUNCTION public.enforce_exam_attempt_eligibility()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_id UUID;
  v_course_in_any_session BOOLEAN;
  v_eligible BOOLEAN;
  v_course_name TEXT;
BEGIN
  -- Skip if no subject (free-form attempts)
  IF NEW.subject_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT s.course_id, et.name
    INTO v_course_id, v_course_name
  FROM public.exam_subjects s
  LEFT JOIN public.exam_titles et ON et.id = s.course_id
  WHERE s.id = NEW.subject_id;

  -- No course attached, allow (back-compat)
  IF v_course_id IS NULL OR v_course_name IS NULL THEN
    RETURN NEW;
  END IF;

  -- Is this course included in ANY session for the tenant? If not, allow (back-compat free-standing courses).
  SELECT EXISTS (
    SELECT 1 FROM public.exam_session_courses esc
    WHERE esc.tenant_id = NEW.tenant_id AND esc.exam_title = v_course_name
  ) INTO v_course_in_any_session;

  IF NOT v_course_in_any_session THEN
    RETURN NEW;
  END IF;

  -- Require an active session covering this course AND (member registered OR auto_open_exams)
  SELECT EXISTS (
    SELECT 1
    FROM public.exam_sessions es
    JOIN public.exam_session_courses esc
      ON esc.session_id = es.id AND esc.tenant_id = es.tenant_id
    WHERE es.tenant_id = NEW.tenant_id
      AND es.status = 'active'
      AND esc.exam_title = v_course_name
      AND (
        es.auto_open_exams IS DISTINCT FROM FALSE
        OR EXISTS (
          SELECT 1 FROM public.course_registrations cr
          WHERE cr.tenant_id = NEW.tenant_id
            AND cr.member_id = NEW.member_id
            AND cr.course_id = v_course_id
            AND cr.session_id = es.id
        )
      )
  ) INTO v_eligible;

  IF NOT v_eligible THEN
    RAISE EXCEPTION 'No active exam session is open for course % — please register first or wait for an admin to open a session', v_course_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_exam_attempt_eligibility ON public.exam_attempts;
CREATE TRIGGER trg_enforce_exam_attempt_eligibility
BEFORE INSERT ON public.exam_attempts
FOR EACH ROW
EXECUTE FUNCTION public.enforce_exam_attempt_eligibility();
