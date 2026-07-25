ALTER TABLE public.teens
  ADD COLUMN IF NOT EXISTS data_processing_consent boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS data_processing_consent_at timestamptz,
  ADD COLUMN IF NOT EXISTS data_processing_consent_by uuid;

UPDATE public.teens
SET data_processing_consent = true,
    data_processing_consent_at = COALESCE(data_processing_consent_at, created_at),
    data_processing_consent_by = COALESCE(data_processing_consent_by, primary_guardian_member_id)
WHERE data_processing_consent = false;