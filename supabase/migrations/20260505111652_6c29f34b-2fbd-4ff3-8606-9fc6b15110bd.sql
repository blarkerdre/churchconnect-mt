ALTER TABLE public.church_attendance_reports
  ADD COLUMN IF NOT EXISTS converts integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS first_timers integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS testimonies integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cars integer NOT NULL DEFAULT 0;