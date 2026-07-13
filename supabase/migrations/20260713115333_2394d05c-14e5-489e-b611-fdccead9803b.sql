
ALTER TABLE public.children
  ADD COLUMN IF NOT EXISTS parental_consent_given boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS parental_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS parental_consent_by uuid REFERENCES public.members(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS consent_photos boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_pastoral_contact boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS consent_medical_emergency boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_notes text;
