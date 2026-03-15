
CREATE TABLE public.church_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.church_units ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage church units"
ON public.church_units
FOR ALL
TO authenticated
USING (is_admin(auth.uid()))
WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Authenticated can view church units"
ON public.church_units
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Public can view church units"
ON public.church_units
FOR SELECT
TO anon
USING (true);

-- Seed existing units
INSERT INTO public.church_units (name) VALUES
  ('Ushering'),
  ('Choir'),
  ('Media'),
  ('Children''s Ministry'),
  ('Protocol'),
  ('Sanctuary Keepers'),
  ('Prayer & Intercession'),
  ('Evangelism'),
  ('Follow-up'),
  ('Pastoral Care'),
  ('Altar Minister'),
  ('Drama'),
  ('Technical'),
  ('Welfare'),
  ('Transportation')
ON CONFLICT (name) DO NOTHING;
