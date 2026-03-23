ALTER TABLE public.exam_subjects
  ADD COLUMN pass_mark_percentage NUMERIC NOT NULL DEFAULT 50,
  ADD COLUMN time_limit_minutes INTEGER DEFAULT NULL,
  ADD COLUMN randomize_questions BOOLEAN NOT NULL DEFAULT false;