
-- Add new statuses to transport_status enum
ALTER TYPE public.transport_status ADD VALUE IF NOT EXISTS 'Notified';
ALTER TYPE public.transport_status ADD VALUE IF NOT EXISTS 'Checked In';
ALTER TYPE public.transport_status ADD VALUE IF NOT EXISTS 'Picked Up';
ALTER TYPE public.transport_status ADD VALUE IF NOT EXISTS 'No-Show';

-- Add timestamp + notes columns for check-in workflow
ALTER TABLE public.transportation
  ADD COLUMN IF NOT EXISTS notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS checked_in_at timestamptz,
  ADD COLUMN IF NOT EXISTS picked_up_at timestamptz,
  ADD COLUMN IF NOT EXISTS no_show_at timestamptz,
  ADD COLUMN IF NOT EXISTS checkin_notes text;

-- Trigger that stamps the matching *_at when status flips
CREATE OR REPLACE FUNCTION public.stamp_transport_status_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status::text = 'Notified' AND NEW.notified_at IS NULL THEN
      NEW.notified_at := now();
    ELSIF NEW.status::text = 'Checked In' AND NEW.checked_in_at IS NULL THEN
      NEW.checked_in_at := now();
    ELSIF NEW.status::text = 'Picked Up' AND NEW.picked_up_at IS NULL THEN
      NEW.picked_up_at := now();
    ELSIF NEW.status::text = 'No-Show' AND NEW.no_show_at IS NULL THEN
      NEW.no_show_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stamp_transport_status_timestamps ON public.transportation;
CREATE TRIGGER trg_stamp_transport_status_timestamps
BEFORE UPDATE ON public.transportation
FOR EACH ROW
EXECUTE FUNCTION public.stamp_transport_status_timestamps();
