
ALTER TABLE public.course_registrations
  ADD COLUMN IF NOT EXISTS student_number TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by UUID;

CREATE UNIQUE INDEX IF NOT EXISTS course_registrations_tenant_student_no_uniq
  ON public.course_registrations (tenant_id, student_number)
  WHERE student_number IS NOT NULL;

CREATE INDEX IF NOT EXISTS course_registrations_status_idx
  ON public.course_registrations (tenant_id, status);

-- Updated numbering function considers both course_registrations and training_completions
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
  v_month TEXT;
  v_year TEXT;
  v_prefix TEXT;
  v_seq INT;
  v_c1 INT;
  v_c2 INT;
BEGIN
  SELECT NULLIF(TRIM(certificate_code), ''), slug
    INTO v_tenant_code, v_tenant_slug
  FROM public.tenants WHERE id = _tenant_id;

  IF v_tenant_code IS NULL THEN
    v_tenant_code := UPPER(COALESCE(v_tenant_slug, 'CERT'));
  END IF;

  SELECT NULLIF(TRIM(course_code), ''), name
    INTO v_course_code, v_course_name
  FROM public.exam_titles WHERE id = _course_id;

  IF v_course_code IS NULL THEN
    v_course_code := UPPER(
      SUBSTRING(
        REGEXP_REPLACE(COALESCE(v_course_name, 'CRS'), '[^A-Za-z ]', '', 'g'),
        1, 4
      )
    );
  END IF;

  v_month := UPPER(TO_CHAR(_completion_date, 'FMMonth'));
  v_year  := TO_CHAR(_completion_date, 'YYYY');
  v_prefix := v_tenant_code || '/' || v_course_code || '/' || v_month || '/' || v_year || '/';

  SELECT COUNT(*) INTO v_c1
  FROM public.training_completions
  WHERE tenant_id = _tenant_id AND student_number LIKE v_prefix || '%';

  SELECT COUNT(*) INTO v_c2
  FROM public.course_registrations
  WHERE tenant_id = _tenant_id AND student_number LIKE v_prefix || '%';

  v_seq := v_c1 + v_c2 + 1;

  RETURN v_prefix || LPAD(v_seq::TEXT, 3, '0');
END;
$function$;

-- RPC: approve a pending registration and assign a student number atomically.
CREATE OR REPLACE FUNCTION public.approve_course_registration(_registration_id uuid)
 RETURNS TABLE(id uuid, student_number text, status text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_tenant uuid;
  v_course uuid;
  v_existing text;
  v_new text;
BEGIN
  SELECT cr.tenant_id, cr.course_id, cr.student_number
    INTO v_tenant, v_course, v_existing
  FROM public.course_registrations cr
  WHERE cr.id = _registration_id;

  IF v_tenant IS NULL THEN
    RAISE EXCEPTION 'Registration not found';
  END IF;

  IF NOT (public.is_admin(auth.uid(), v_tenant)) THEN
    RAISE EXCEPTION 'Not authorised';
  END IF;

  IF v_existing IS NULL OR v_existing = '' THEN
    v_new := public.next_student_number(v_tenant, v_course, CURRENT_DATE);
  ELSE
    v_new := v_existing;
  END IF;

  UPDATE public.course_registrations
     SET status = 'approved',
         approved_at = COALESCE(approved_at, now()),
         approved_by = COALESCE(approved_by, auth.uid()),
         student_number = v_new
   WHERE course_registrations.id = _registration_id;

  RETURN QUERY
    SELECT cr.id, cr.student_number, cr.status
    FROM public.course_registrations cr
    WHERE cr.id = _registration_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.approve_course_registration(uuid) TO authenticated;
