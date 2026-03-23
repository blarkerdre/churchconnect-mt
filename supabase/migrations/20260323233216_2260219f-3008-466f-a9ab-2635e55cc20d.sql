ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS is_recurring boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS recurrence_frequency text,
  ADD COLUMN IF NOT EXISTS recurrence_end_date date,
  ADD COLUMN IF NOT EXISTS recurrence_parent_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS reminder_days_before integer[],
  ADD COLUMN IF NOT EXISTS reminder_sent boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_events_reminder_lookup 
  ON public.events (event_date, reminder_sent) 
  WHERE reminder_days_before IS NOT NULL AND reminder_sent = false;

CREATE INDEX IF NOT EXISTS idx_events_recurrence_parent 
  ON public.events (recurrence_parent_id) 
  WHERE recurrence_parent_id IS NOT NULL;