
-- Add tenant_id to Batch A tables (nullable for backward compatibility)

-- members
ALTER TABLE public.members ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_members_tenant_id ON public.members(tenant_id);

-- profiles
ALTER TABLE public.profiles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_profiles_tenant_id ON public.profiles(tenant_id);

-- user_roles
ALTER TABLE public.user_roles ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_user_roles_tenant_id ON public.user_roles(tenant_id);

-- followups
ALTER TABLE public.followups ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_followups_tenant_id ON public.followups(tenant_id);

-- pastoral_care
ALTER TABLE public.pastoral_care ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_pastoral_care_tenant_id ON public.pastoral_care(tenant_id);

-- notifications
ALTER TABLE public.notifications ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_notifications_tenant_id ON public.notifications(tenant_id);

-- messages
ALTER TABLE public.messages ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_messages_tenant_id ON public.messages(tenant_id);

-- Backfill all existing rows with the default tenant ID
UPDATE public.members SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.profiles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.user_roles SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.followups SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.pastoral_care SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.notifications SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.messages SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
