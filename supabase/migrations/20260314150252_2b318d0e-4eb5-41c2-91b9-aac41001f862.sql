
CREATE TABLE public.sms_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id uuid NOT NULL,
  recipient_phone text NOT NULL,
  recipient_member_id uuid REFERENCES public.members(id) ON DELETE SET NULL,
  message text NOT NULL,
  sms_type text NOT NULL DEFAULT 'bulk',
  reference_id text,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sms_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/leaders can view sms logs"
  ON public.sms_log FOR SELECT TO authenticated
  USING (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));

CREATE POLICY "Admins/leaders can insert sms logs"
  ON public.sms_log FOR INSERT TO authenticated
  WITH CHECK (is_admin(auth.uid()) OR has_role(auth.uid(), 'unit_leader'::app_role));
