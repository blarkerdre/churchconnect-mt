
-- Add SMS and WhatsApp monthly limit columns to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS sms_limit_monthly integer NOT NULL DEFAULT 0;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS whatsapp_limit_monthly integer NOT NULL DEFAULT 0;

-- Create function to get tenant message usage for current month
CREATE OR REPLACE FUNCTION public.get_tenant_message_usage(_tenant_id uuid)
RETURNS TABLE(sms_count bigint, whatsapp_count bigint)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    count(*) FILTER (WHERE channel = 'sms' AND status = 'sent') as sms_count,
    count(*) FILTER (WHERE channel = 'whatsapp' AND status = 'sent') as whatsapp_count
  FROM public.sms_log
  WHERE tenant_id = _tenant_id
    AND created_at >= date_trunc('month', now());
$$;
