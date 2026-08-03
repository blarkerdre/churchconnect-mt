
ALTER TABLE public.wofbi_applications ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.wofbi_attendance_sessions ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.lecturer_qc_checks ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.lecturer_ratings ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;
ALTER TABLE public.wofbi_feedback_responses ADD COLUMN IF NOT EXISTS session_id uuid REFERENCES public.exam_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wofbi_applications_tenant_session ON public.wofbi_applications(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_wofbi_att_sessions_tenant_session ON public.wofbi_attendance_sessions(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_qc_checks_tenant_session ON public.lecturer_qc_checks(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_lecturer_ratings_tenant_session ON public.lecturer_ratings(tenant_id, session_id);
CREATE INDEX IF NOT EXISTS idx_wofbi_feedback_responses_tenant_session ON public.wofbi_feedback_responses(tenant_id, session_id);

CREATE OR REPLACE FUNCTION public.resolve_exam_session_for_course(_tenant_id uuid, _course_id uuid, _on_date date)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.id
  FROM public.exam_sessions s
  JOIN public.exam_session_courses sc ON sc.session_id = s.id
  JOIN public.exam_titles t ON lower(t.name) = lower(sc.exam_title)
  WHERE s.tenant_id = _tenant_id
    AND t.id = _course_id
    AND (
      (_on_date IS NOT NULL AND s.starts_on IS NOT NULL AND s.ends_on IS NOT NULL
        AND _on_date BETWEEN s.starts_on AND s.ends_on)
      OR (_on_date IS NULL AND s.status = 'open')
    )
  ORDER BY (s.status = 'open') DESC, s.starts_on DESC NULLS LAST
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.stamp_wofbi_session_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course uuid;
  v_date date;
BEGIN
  IF NEW.session_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'lecturer_qc_checks' THEN
    v_course := NEW.exam_title_id;
    v_date := NEW.check_date;
  ELSIF TG_TABLE_NAME = 'wofbi_attendance_sessions' THEN
    v_course := NEW.course_id;
    v_date := NEW.session_date;
  ELSE
    v_course := NEW.course_id;
    v_date := COALESCE(NEW.created_at::date, CURRENT_DATE);
  END IF;

  IF v_course IS NULL THEN
    RETURN NEW;
  END IF;

  NEW.session_id := COALESCE(
    public.resolve_exam_session_for_course(NEW.tenant_id, v_course, v_date),
    public.resolve_exam_session_for_course(NEW.tenant_id, v_course, NULL)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_session_wofbi_applications ON public.wofbi_applications;
CREATE TRIGGER trg_stamp_session_wofbi_applications BEFORE INSERT ON public.wofbi_applications
FOR EACH ROW EXECUTE FUNCTION public.stamp_wofbi_session_id();

DROP TRIGGER IF EXISTS trg_stamp_session_wofbi_att_sessions ON public.wofbi_attendance_sessions;
CREATE TRIGGER trg_stamp_session_wofbi_att_sessions BEFORE INSERT ON public.wofbi_attendance_sessions
FOR EACH ROW EXECUTE FUNCTION public.stamp_wofbi_session_id();

DROP TRIGGER IF EXISTS trg_stamp_session_lecturer_qc_checks ON public.lecturer_qc_checks;
CREATE TRIGGER trg_stamp_session_lecturer_qc_checks BEFORE INSERT ON public.lecturer_qc_checks
FOR EACH ROW EXECUTE FUNCTION public.stamp_wofbi_session_id();

DROP TRIGGER IF EXISTS trg_stamp_session_lecturer_ratings ON public.lecturer_ratings;
CREATE TRIGGER trg_stamp_session_lecturer_ratings BEFORE INSERT ON public.lecturer_ratings
FOR EACH ROW EXECUTE FUNCTION public.stamp_wofbi_session_id();

DROP TRIGGER IF EXISTS trg_stamp_session_wofbi_feedback_responses ON public.wofbi_feedback_responses;
CREATE TRIGGER trg_stamp_session_wofbi_feedback_responses BEFORE INSERT ON public.wofbi_feedback_responses
FOR EACH ROW EXECUTE FUNCTION public.stamp_wofbi_session_id();

UPDATE public.wofbi_applications a
SET session_id = COALESCE(public.resolve_exam_session_for_course(a.tenant_id, a.course_id, a.created_at::date),
                          public.resolve_exam_session_for_course(a.tenant_id, a.course_id, NULL))
WHERE a.session_id IS NULL AND a.course_id IS NOT NULL;

UPDATE public.wofbi_attendance_sessions s
SET session_id = COALESCE(public.resolve_exam_session_for_course(s.tenant_id, s.course_id, s.session_date),
                          public.resolve_exam_session_for_course(s.tenant_id, s.course_id, NULL))
WHERE s.session_id IS NULL AND s.course_id IS NOT NULL;

UPDATE public.lecturer_qc_checks q
SET session_id = COALESCE(public.resolve_exam_session_for_course(q.tenant_id, q.exam_title_id, q.check_date),
                          public.resolve_exam_session_for_course(q.tenant_id, q.exam_title_id, NULL))
WHERE q.session_id IS NULL AND q.exam_title_id IS NOT NULL;

UPDATE public.lecturer_ratings r
SET session_id = COALESCE(public.resolve_exam_session_for_course(r.tenant_id, r.course_id, r.created_at::date),
                          public.resolve_exam_session_for_course(r.tenant_id, r.course_id, NULL))
WHERE r.session_id IS NULL AND r.course_id IS NOT NULL;

UPDATE public.wofbi_feedback_responses f
SET session_id = COALESCE(public.resolve_exam_session_for_course(f.tenant_id, f.course_id, f.created_at::date),
                          public.resolve_exam_session_for_course(f.tenant_id, f.course_id, NULL))
WHERE f.session_id IS NULL AND f.course_id IS NOT NULL;
