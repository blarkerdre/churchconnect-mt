
-- Create channel enum
CREATE TYPE public.followup_message_channel AS ENUM ('sms', 'email');

-- Create status enum
CREATE TYPE public.followup_message_status AS ENUM ('draft', 'scheduled', 'sent', 'failed', 'cancelled');

-- Create the scheduled messages table
CREATE TABLE public.followup_scheduled_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  followup_id UUID REFERENCES public.followups(id) ON DELETE CASCADE NOT NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  channel followup_message_channel NOT NULL,
  recipient_phone TEXT,
  recipient_email TEXT,
  recipient_name TEXT,
  subject TEXT,
  message TEXT NOT NULL,
  scheduled_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  status followup_message_status NOT NULL DEFAULT 'draft',
  error_message TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.followup_scheduled_messages ENABLE ROW LEVEL SECURITY;

-- RLS: Admins/leaders can manage
CREATE POLICY "Admins/leaders can manage followup messages"
ON public.followup_scheduled_messages
FOR ALL TO authenticated
USING (
  is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
)
WITH CHECK (
  is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
);

-- RLS: Assigned users can view/manage their own followup messages
CREATE POLICY "Assigned users can manage own followup messages"
ON public.followup_scheduled_messages
FOR ALL TO authenticated
USING (
  auth.uid() = created_by AND user_has_tenant_access(tenant_id)
)
WITH CHECK (
  auth.uid() = created_by AND user_has_tenant_access(tenant_id)
);
