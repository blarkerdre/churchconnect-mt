CREATE TABLE public.trustpilot_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stars SMALLINT NOT NULL DEFAULT 5,
  title TEXT,
  body TEXT NOT NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_location TEXT,
  review_date DATE,
  review_url TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_published BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT trustpilot_reviews_stars_range CHECK (stars BETWEEN 1 AND 5)
);

GRANT SELECT ON public.trustpilot_reviews TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.trustpilot_reviews TO authenticated;
GRANT ALL ON public.trustpilot_reviews TO service_role;

ALTER TABLE public.trustpilot_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view published Trustpilot reviews"
  ON public.trustpilot_reviews FOR SELECT
  USING (is_published = true OR public.has_role(auth.uid(), 'super_admin'));

CREATE POLICY "Super admins manage Trustpilot reviews"
  ON public.trustpilot_reviews FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TABLE public.trustpilot_settings (
  id BOOLEAN NOT NULL DEFAULT true PRIMARY KEY,
  profile_url TEXT,
  review_url TEXT,
  overall_score NUMERIC(2,1),
  total_reviews INTEGER,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT trustpilot_settings_singleton CHECK (id = true)
);

GRANT SELECT ON public.trustpilot_settings TO anon;
GRANT SELECT, INSERT, UPDATE ON public.trustpilot_settings TO authenticated;
GRANT ALL ON public.trustpilot_settings TO service_role;

ALTER TABLE public.trustpilot_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view Trustpilot settings"
  ON public.trustpilot_settings FOR SELECT
  USING (true);

CREATE POLICY "Super admins manage Trustpilot settings"
  ON public.trustpilot_settings FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'super_admin'))
  WITH CHECK (public.has_role(auth.uid(), 'super_admin'));

CREATE TRIGGER update_trustpilot_reviews_updated_at
  BEFORE UPDATE ON public.trustpilot_reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_trustpilot_settings_updated_at
  BEFORE UPDATE ON public.trustpilot_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.trustpilot_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;