CREATE OR REPLACE FUNCTION public.apply_exam_session_course_flags()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_status text := lower(coalesce(NEW.status, 'draft'));
  old_status text := lower(coalesce(OLD.status, 'draft'));
BEGIN
  IF new_status = old_status THEN
    RETURN NEW;
  END IF;

  IF new_status = 'active' THEN
    UPDATE public.exam_titles t
       SET registration_open = true,
           exams_open = CASE WHEN coalesce(NEW.auto_open_exams, false) THEN true ELSE t.exams_open END
     WHERE t.tenant_id = NEW.tenant_id
       AND t.name IN (
         SELECT sc.exam_title FROM public.exam_session_courses sc
          WHERE sc.session_id = NEW.id AND sc.tenant_id = NEW.tenant_id
       );
  ELSIF new_status = 'closed' THEN
    UPDATE public.exam_titles t
       SET registration_open = false,
           exams_open = CASE WHEN coalesce(NEW.auto_open_exams, false) THEN false ELSE t.exams_open END
     WHERE t.tenant_id = NEW.tenant_id
       AND t.name IN (
         SELECT sc.exam_title FROM public.exam_session_courses sc
          WHERE sc.session_id = NEW.id AND sc.tenant_id = NEW.tenant_id
       )
       AND NOT EXISTS (
         SELECT 1
           FROM public.exam_session_courses sc2
           JOIN public.exam_sessions s2 ON s2.id = sc2.session_id
          WHERE sc2.exam_title = t.name
            AND sc2.tenant_id = NEW.tenant_id
            AND s2.id <> NEW.id
            AND lower(coalesce(s2.status, 'draft')) = 'active'
       );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_apply_exam_session_course_flags ON public.exam_sessions;
CREATE TRIGGER trg_apply_exam_session_course_flags
AFTER UPDATE OF status ON public.exam_sessions
FOR EACH ROW
EXECUTE FUNCTION public.apply_exam_session_course_flags();