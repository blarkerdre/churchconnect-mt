CREATE OR REPLACE FUNCTION public.assign_student_number_on_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.student_number IS NULL OR NEW.student_number = '' THEN
    NEW.student_number := public.next_student_number(NEW.tenant_id, NEW.course_id, CURRENT_DATE);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_assign_student_number ON public.course_registrations;
CREATE TRIGGER trg_assign_student_number
BEFORE INSERT ON public.course_registrations
FOR EACH ROW
EXECUTE FUNCTION public.assign_student_number_on_registration();