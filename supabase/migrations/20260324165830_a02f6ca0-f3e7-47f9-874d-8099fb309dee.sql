
-- Create tenant_role enum
CREATE TYPE public.tenant_role AS ENUM ('owner', 'admin', 'member');

-- Create tenants table
CREATE TABLE public.tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  timezone text NOT NULL DEFAULT 'Europe/London',
  settings jsonb DEFAULT '{}'::jsonb,
  setup_complete boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Create tenant_memberships table
CREATE TABLE public.tenant_memberships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role tenant_role NOT NULL DEFAULT 'member',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, tenant_id)
);

CREATE INDEX idx_tenant_memberships_tenant_id ON public.tenant_memberships(tenant_id);
CREATE INDEX idx_tenant_memberships_user_id ON public.tenant_memberships(user_id);

-- Enable RLS
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_memberships ENABLE ROW LEVEL SECURITY;

-- RLS for tenants: users can read tenants they belong to
CREATE POLICY "Users can view own tenants"
  ON public.tenants FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid()
  ));

-- Tenant admins/owners can update their tenant
CREATE POLICY "Tenant admins can update tenant"
  ON public.tenants FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenants.id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ));

-- RLS for tenant_memberships: users can read own memberships
CREATE POLICY "Users can view own memberships"
  ON public.tenant_memberships FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Tenant admins/owners can view all memberships for their tenant
CREATE POLICY "Tenant admins can view tenant memberships"
  ON public.tenant_memberships FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenant_memberships.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ));

-- Tenant admins/owners can manage memberships
CREATE POLICY "Tenant admins can manage memberships"
  ON public.tenant_memberships FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenant_memberships.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tenant_memberships tm
    WHERE tm.tenant_id = tenant_memberships.tenant_id AND tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
  ));

-- Helper function: user_belongs_to_tenant
CREATE OR REPLACE FUNCTION public.user_belongs_to_tenant(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id
  )
$$;

-- Helper function: is_tenant_admin
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id AND role IN ('owner', 'admin')
  )
$$;

-- Updated_at trigger for tenants
CREATE TRIGGER update_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
