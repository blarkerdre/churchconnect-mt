
-- Add plan tier and limits columns to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS plan_tier text NOT NULL DEFAULT 'free';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS member_limit integer NOT NULL DEFAULT 100;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS storage_limit_mb integer NOT NULL DEFAULT 500;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS archived_at timestamp with time zone;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS archived_by uuid;

-- Add invitation tracking table
CREATE TABLE IF NOT EXISTS public.tenant_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  invited_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  token text NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  expires_at timestamp with time zone NOT NULL DEFAULT (now() + interval '7 days'),
  accepted_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.tenant_invitations ENABLE ROW LEVEL SECURITY;

-- Super admins and tenant admins can manage invitations
CREATE POLICY "Admins can manage invitations" ON public.tenant_invitations
  FOR ALL TO authenticated
  USING (is_admin(auth.uid()) OR is_tenant_admin(auth.uid(), tenant_id))
  WITH CHECK (is_admin(auth.uid()) OR is_tenant_admin(auth.uid(), tenant_id));
