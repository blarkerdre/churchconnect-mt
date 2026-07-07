ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS wofbi_logo_url text,
  ADD COLUMN IF NOT EXISTS centre_name text;

ALTER TABLE public.exam_titles
  ADD COLUMN IF NOT EXISTS letter_grade_bands jsonb;