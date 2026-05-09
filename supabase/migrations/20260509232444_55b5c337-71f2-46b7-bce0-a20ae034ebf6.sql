
ALTER TABLE public.exam_sessions
  ADD COLUMN IF NOT EXISTS starts_on date,
  ADD COLUMN IF NOT EXISTS ends_on date,
  ADD COLUMN IF NOT EXISTS auto_open_exams boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_reregistration boolean NOT NULL DEFAULT true;
