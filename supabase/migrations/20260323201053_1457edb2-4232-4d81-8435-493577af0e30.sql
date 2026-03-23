ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS male_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS female_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS unit text;