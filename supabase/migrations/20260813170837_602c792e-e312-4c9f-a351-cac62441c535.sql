CREATE OR REPLACE FUNCTION public.stamp_exam_attempt_session()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.session_id IS NULL AND NEW.subject_id IS NOT NULL THEN
    SELECT s.session_id INTO NEW.session_id
    FROM public.exam_subjects s
    WHERE s.id = NEW.subject_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_exam_attempt_session ON public.exam_attempts;
CREATE TRIGGER trg_stamp_exam_attempt_session
BEFORE INSERT OR UPDATE OF subject_id ON public.exam_attempts
FOR EACH ROW EXECUTE FUNCTION public.stamp_exam_attempt_session();