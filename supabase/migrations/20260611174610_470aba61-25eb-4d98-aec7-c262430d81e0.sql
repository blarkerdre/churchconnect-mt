ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS journey_type text NOT NULL DEFAULT 'Single',
  ADD COLUMN IF NOT EXISTS return_date date,
  ADD COLUMN IF NOT EXISTS return_time time;