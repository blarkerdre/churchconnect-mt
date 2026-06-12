ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS pickup_postcode text,
  ADD COLUMN IF NOT EXISTS nearest_pickup_location_id uuid REFERENCES public.pickup_locations(id) ON DELETE SET NULL;

ALTER TABLE public.pickup_locations
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;