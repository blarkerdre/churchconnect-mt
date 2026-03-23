ALTER TABLE public.certificate_templates
  ADD COLUMN IF NOT EXISTS background_image_url text,
  ADD COLUMN IF NOT EXISTS text_positions jsonb DEFAULT '{"name_y": 280, "training_y": 340, "date_y": 380, "signatory_y": 500}'::jsonb;