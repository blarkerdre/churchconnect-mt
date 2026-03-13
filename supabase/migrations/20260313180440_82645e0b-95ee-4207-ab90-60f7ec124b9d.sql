
ALTER TABLE public.wsf_centres 
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS address text,
  ADD COLUMN IF NOT EXISTS city text DEFAULT 'Cardiff',
  ADD COLUMN IF NOT EXISTS coverage_postcodes text;

COMMENT ON COLUMN public.wsf_centres.coverage_postcodes IS 'Comma-separated postcode prefixes this centre covers, e.g. CF10,CF11,CF14';
