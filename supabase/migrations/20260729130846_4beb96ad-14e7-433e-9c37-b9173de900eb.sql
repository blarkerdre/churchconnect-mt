ALTER TABLE public.wofbi_attendance_records
  ADD COLUMN IF NOT EXISTS punctuality_rating smallint,
  ADD COLUMN IF NOT EXISTS punctuality_note text;

ALTER TABLE public.wofbi_attendance_records
  DROP CONSTRAINT IF EXISTS wofbi_attendance_records_punctuality_rating_check;

ALTER TABLE public.wofbi_attendance_records
  ADD CONSTRAINT wofbi_attendance_records_punctuality_rating_check
  CHECK (punctuality_rating IS NULL OR (punctuality_rating BETWEEN 1 AND 5));