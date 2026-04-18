-- Add delivery tracking columns to call_log
ALTER TABLE public.call_log
  ADD COLUMN IF NOT EXISTS delivery_status text,
  ADD COLUMN IF NOT EXISTS delivery_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

-- Trigger to auto-bump updated_at
DROP TRIGGER IF EXISTS update_call_log_updated_at ON public.call_log;
CREATE TRIGGER update_call_log_updated_at
BEFORE UPDATE ON public.call_log
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();