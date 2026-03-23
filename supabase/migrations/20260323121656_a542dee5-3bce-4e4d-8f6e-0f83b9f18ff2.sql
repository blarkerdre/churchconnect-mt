ALTER TABLE public.exam_attempts
  ADD COLUMN retake_allowed BOOLEAN NOT NULL DEFAULT false;