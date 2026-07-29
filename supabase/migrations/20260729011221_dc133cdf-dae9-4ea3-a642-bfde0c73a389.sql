ALTER TABLE public.exam_subjects
  ADD COLUMN IF NOT EXISTS lecturer_id uuid REFERENCES public.lecturers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_exam_subjects_lecturer_id ON public.exam_subjects(lecturer_id);