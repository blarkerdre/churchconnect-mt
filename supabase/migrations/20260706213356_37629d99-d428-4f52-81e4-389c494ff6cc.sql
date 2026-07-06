
ALTER TABLE public.exam_titles
  ADD COLUMN IF NOT EXISTS starting_number INTEGER NOT NULL DEFAULT 1
  CHECK (starting_number >= 1);

CREATE OR REPLACE FUNCTION public.next_student_number(_tenant_id uuid, _course_id uuid, _completion_date date)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_tenant_code TEXT;
  v_tenant_slug TEXT;
  v_course_code TEXT;
  v_course_name TEXT;
  v_starting INT;
  v_month TEXT;
  v_year TEXT;
  v_prefix TEXT;
  v_max1 INT;
  v_max2 INT;
  v_max INT;
  v_seq INT;
BEGIN
  SELECT NULLIF(TRIM(certificate_code), ''), slug
    INTO v_tenant_code, v_tenant_slug
  FROM public.tenants WHERE id = _tenant_id;

  IF v_tenant_code IS NULL THEN
    v_tenant_code := UPPER(COALESCE(v_tenant_slug, 'CERT'));
  END IF;

  SELECT NULLIF(TRIM(course_code), ''), name, COALESCE(starting_number, 1)
    INTO v_course_code, v_course_name, v_starting
  FROM public.exam_titles WHERE id = _course_id;

  IF v_course_code IS NULL THEN
    v_course_code := UPPER(
      SUBSTRING(
        REGEXP_REPLACE(COALESCE(v_course_name, 'CRS'), '[^A-Za-z ]', '', 'g'),
        1, 4
      )
    );
  END IF;

  v_starting := COALESCE(v_starting, 1);

  v_month := UPPER(TO_CHAR(_completion_date, 'FMMonth'));
  v_year  := TO_CHAR(_completion_date, 'YYYY');
  v_prefix := v_tenant_code || '/' || v_course_code || '/' || v_month || '/' || v_year || '/';

  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(SUBSTRING(student_number FROM LENGTH(v_prefix) + 1), '\D', '', 'g'), '')::INT), 0)
    INTO v_max1
  FROM public.training_completions
  WHERE tenant_id = _tenant_id AND student_number LIKE v_prefix || '%';

  SELECT COALESCE(MAX(NULLIF(REGEXP_REPLACE(SUBSTRING(student_number FROM LENGTH(v_prefix) + 1), '\D', '', 'g'), '')::INT), 0)
    INTO v_max2
  FROM public.course_registrations
  WHERE tenant_id = _tenant_id AND student_number LIKE v_prefix || '%';

  v_max := GREATEST(v_max1, v_max2);
  v_seq := GREATEST(v_max + 1, v_starting);

  RETURN v_prefix || LPAD(v_seq::TEXT, 3, '0');
END;
$function$;
