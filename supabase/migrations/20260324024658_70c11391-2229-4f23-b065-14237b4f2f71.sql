
-- Create wsf_zones table
CREATE TABLE public.wsf_zones (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wsf_zones ENABLE ROW LEVEL SECURITY;

-- Admins can manage zones
CREATE POLICY "Admins can manage wsf zones"
  ON public.wsf_zones FOR ALL TO authenticated
  USING (is_admin(auth.uid()))
  WITH CHECK (is_admin(auth.uid()));

-- Authenticated can view zones
CREATE POLICY "Authenticated can view wsf zones"
  ON public.wsf_zones FOR SELECT TO authenticated
  USING (true);

-- Add zone_id to wsf_centres
ALTER TABLE public.wsf_centres
  ADD COLUMN zone_id uuid REFERENCES public.wsf_zones(id) ON DELETE SET NULL;
