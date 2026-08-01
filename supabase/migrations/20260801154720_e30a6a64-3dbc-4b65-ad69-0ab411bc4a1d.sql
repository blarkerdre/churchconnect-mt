-- 1. Auto-schedule flag on exam sessions
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS auto_schedule boolean NOT NULL DEFAULT false;

-- 2. Keep updated_at fresh
CREATE OR REPLACE FUNCTION public.touch_exam_sessions_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_exam_sessions_updated_at ON public.exam_sessions;
CREATE TRIGGER trg_exam_sessions_updated_at
BEFORE UPDATE ON public.exam_sessions
FOR EACH ROW EXECUTE FUNCTION public.touch_exam_sessions_updated_at();

-- 3. Stamp new course registrations with the active session for their course
CREATE OR REPLACE FUNCTION public.stamp_course_registration_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_course_name text;
  v_session uuid;
BEGIN
  IF NEW.session_id IS NOT NULL OR NEW.course_id IS NULL OR NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT et.name INTO v_course_name
  FROM public.exam_titles et
  WHERE et.id = NEW.course_id;

  IF v_course_name IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT es.id INTO v_session
  FROM public.exam_sessions es
  JOIN public.exam_session_courses esc ON esc.session_id = es.id
  WHERE es.tenant_id = NEW.tenant_id
    AND esc.exam_title = v_course_name
    AND es.status = 'active'
  ORDER BY es.started_at DESC NULLS LAST, es.created_at DESC
  LIMIT 1;

  NEW.session_id := v_session;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_course_registration_session ON public.course_registrations;
CREATE TRIGGER trg_stamp_course_registration_session
BEFORE INSERT ON public.course_registrations
FOR EACH ROW EXECUTE FUNCTION public.stamp_course_registration_session();

-- 4. Auto open/close scheduled sessions
CREATE OR REPLACE FUNCTION public.auto_manage_exam_sessions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exam_sessions
     SET status = 'active',
         started_at = COALESCE(started_at, now())
   WHERE auto_schedule = true
     AND status = 'draft'
     AND starts_on IS NOT NULL
     AND starts_on <= CURRENT_DATE;

  UPDATE public.exam_sessions
     SET status = 'closed',
         ended_at = COALESCE(ended_at, now())
   WHERE auto_schedule = true
     AND status = 'active'
     AND ends_on IS NOT NULL
     AND ends_on < CURRENT_DATE;
END;
$$;

SELECT cron.unschedule('auto-manage-exam-sessions')
WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'auto-manage-exam-sessions');

SELECT cron.schedule('auto-manage-exam-sessions', '* * * * *', $$select public.auto_manage_exam_sessions();$$);