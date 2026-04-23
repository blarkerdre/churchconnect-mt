ALTER TABLE public.exam_titles DROP CONSTRAINT IF EXISTS exam_titles_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS exam_titles_tenant_name_unique
  ON public.exam_titles (tenant_id, lower(name));