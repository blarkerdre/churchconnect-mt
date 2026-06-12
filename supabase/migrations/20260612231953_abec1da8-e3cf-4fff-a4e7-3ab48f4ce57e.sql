ALTER TABLE public.transportation 
  ADD COLUMN IF NOT EXISTS auto_matched boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS assigned_at timestamptz;