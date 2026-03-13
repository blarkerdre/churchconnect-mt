
-- Add status to attendance_sessions for close session functionality
ALTER TABLE public.attendance_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';

-- Create pickup_locations table for transportation
CREATE TABLE public.pickup_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  address text NOT NULL,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.pickup_locations ENABLE ROW LEVEL SECURITY;

-- Everyone can view active pickup locations
CREATE POLICY "Authenticated can view pickup locations"
ON public.pickup_locations FOR SELECT TO authenticated
USING (true);

-- Admins and unit leaders can manage pickup locations
CREATE POLICY "Admins/leaders can manage pickup locations"
ON public.pickup_locations FOR ALL TO authenticated
USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role))
WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));
