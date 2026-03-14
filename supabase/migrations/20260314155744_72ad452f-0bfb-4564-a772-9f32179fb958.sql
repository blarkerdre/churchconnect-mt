ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS message_sid text;
ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS delivery_status text DEFAULT 'queued';
ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz;