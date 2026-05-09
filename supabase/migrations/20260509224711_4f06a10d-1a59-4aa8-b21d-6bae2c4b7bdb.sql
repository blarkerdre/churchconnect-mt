
-- Birthday message settings (one row per tenant)
CREATE TABLE IF NOT EXISTS public.birthday_message_settings (
  tenant_id uuid PRIMARY KEY REFERENCES public.tenants(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT false,
  channels text[] NOT NULL DEFAULT ARRAY['in_app']::text[],
  send_hour_local int NOT NULL DEFAULT 8 CHECK (send_hour_local BETWEEN 0 AND 23),
  email_subject text NOT NULL DEFAULT 'Happy Birthday, {first_name}! 🎂',
  email_body text NOT NULL DEFAULT 'Dear {first_name},

Happy Birthday! 🎂 The {church_name} family is celebrating you today. We pray that this new year of your life brings joy, peace, and abundant blessings.

You are loved and appreciated.

With love,
The {church_name} Family',
  sms_template text NOT NULL DEFAULT 'Happy Birthday, {first_name}! 🎂 The {church_name} family is praying for a year filled with God''s blessings. You are loved!',
  whatsapp_template text NOT NULL DEFAULT 'Happy Birthday, {first_name}! 🎂 The {church_name} family is celebrating you today. May this year be filled with joy, peace, and God''s abundant blessings. You are loved! 🙏',
  in_app_template text NOT NULL DEFAULT '🎂 Happy Birthday, {first_name}! The {church_name} family is celebrating you today.',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.birthday_message_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins manage birthday settings"
  ON public.birthday_message_settings
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));

CREATE TRIGGER birthday_settings_updated_at
  BEFORE UPDATE ON public.birthday_message_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Birthday message log
CREATE TABLE IF NOT EXISTS public.birthday_message_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES public.members(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('in_app','email','sms','whatsapp')),
  sent_on date NOT NULL DEFAULT (now() AT TIME ZONE 'UTC')::date,
  status text NOT NULL DEFAULT 'sent' CHECK (status IN ('sent','failed','skipped')),
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS birthday_log_unique_per_day
  ON public.birthday_message_log (tenant_id, member_id, channel, sent_on);

CREATE INDEX IF NOT EXISTS birthday_log_tenant_date_idx
  ON public.birthday_message_log (tenant_id, sent_on DESC);

ALTER TABLE public.birthday_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tenant admins read birthday log"
  ON public.birthday_message_log
  FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id));
