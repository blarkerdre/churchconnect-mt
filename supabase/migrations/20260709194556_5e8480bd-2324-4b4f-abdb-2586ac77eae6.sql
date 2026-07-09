CREATE OR REPLACE FUNCTION public.protect_exam_attempt_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  _is_admin boolean;
BEGIN
  SELECT public.is_admin(auth.uid(), NEW.tenant_id) INTO _is_admin;
  IF _is_admin OR current_setting('role', true) = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.score IS DISTINCT FROM NEW.score
     OR OLD.passed IS DISTINCT FROM NEW.passed
     OR OLD.certificate_issued IS DISTINCT FROM NEW.certificate_issued
     OR OLD.total_points IS DISTINCT FROM NEW.total_points
  THEN
    RAISE EXCEPTION 'You are not allowed to modify exam results';
  END IF;

  RETURN NEW;
END;
$function$;