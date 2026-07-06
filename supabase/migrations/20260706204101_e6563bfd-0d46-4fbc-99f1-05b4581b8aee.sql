
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS certificate_code TEXT;
ALTER TABLE public.exam_titles ADD COLUMN IF NOT EXISTS course_code TEXT;
ALTER TABLE public.training_completions ADD COLUMN IF NOT EXISTS student_number TEXT;
ALTER TABLE public.training_completions ADD COLUMN IF NOT EXISTS grade_classification TEXT;
ALTER TABLE public.certificate_templates ADD COLUMN IF NOT EXISTS dean_signature_url TEXT;
ALTER TABLE public.certificate_templates ADD COLUMN IF NOT EXISTS crest_image_url TEXT;
ALTER TABLE public.certificate_templates ADD COLUMN IF NOT EXISTS name_color TEXT;

CREATE INDEX IF NOT EXISTS training_completions_student_number_idx
  ON public.training_completions (tenant_id, student_number);

CREATE OR REPLACE FUNCTION public.next_student_number(
  _tenant_id UUID,
  _course_id UUID,
  _completion_date DATE
) RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tenant_code TEXT;
  v_tenant_slug TEXT;
  v_course_code TEXT;
  v_course_name TEXT;
  v_month TEXT;
  v_year TEXT;
  v_prefix TEXT;
  v_seq INT;
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
    -- Fallback: first letters of words in course name, up to 4 chars.
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

  SELECT COUNT(*) + 1 INTO v_seq
  FROM public.training_completions
  WHERE tenant_id = _tenant_id
    AND student_number LIKE v_prefix || '%';

  RETURN v_prefix || LPAD(v_seq::TEXT, 3, '0');
END;
$$;

GRANT EXECUTE ON FUNCTION public.next_student_number(UUID, UUID, DATE) TO authenticated, service_role;
