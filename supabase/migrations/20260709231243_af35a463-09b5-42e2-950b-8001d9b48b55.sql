ALTER TABLE public.lecturer_ratings
  ADD COLUMN IF NOT EXISTS course_id uuid REFERENCES public.exam_titles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subject_id uuid REFERENCES public.exam_subjects(id) ON DELETE SET NULL;

ALTER TABLE public.lecturer_ratings DROP CONSTRAINT IF EXISTS lecturer_ratings_tenant_id_lecturer_id_submitted_by_key;
ALTER TABLE public.lecturer_ratings DROP CONSTRAINT IF EXISTS lecturer_ratings_tenant_lecturer_submitted_unique;

CREATE UNIQUE INDEX IF NOT EXISTS lecturer_ratings_unique_per_subject
  ON public.lecturer_ratings (tenant_id, lecturer_id, submitted_by, subject_id);