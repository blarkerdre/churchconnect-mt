
-- Migration 1: Fix user_roles unique constraint for multi-tenancy
ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_user_id_role_key;
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_role_tenant_key UNIQUE (user_id, role, tenant_id);

-- Migration 2: Allow invitation-based self-insert into tenant_memberships
CREATE POLICY "Users can accept invitations for themselves"
ON public.tenant_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tenant_invitations ti
    WHERE lower(ti.email) = lower((SELECT email FROM auth.users WHERE id = auth.uid()))
    AND ti.tenant_id = tenant_memberships.tenant_id
    AND ti.status = 'pending'
  )
);

-- Allow users to update invitation status for their own email
CREATE POLICY "Users can accept their own invitations"
ON public.tenant_invitations
FOR UPDATE
TO authenticated
USING (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())))
WITH CHECK (lower(email) = lower((SELECT email FROM auth.users WHERE id = auth.uid())) AND status = 'accepted');

-- Migration 3: Update handle_new_user trigger to resolve tenant from pending invitation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _tenant_id uuid;
BEGIN
  SELECT tenant_id INTO _tenant_id
  FROM public.tenant_invitations
  WHERE lower(email) = lower(NEW.email)
    AND status = 'pending'
  LIMIT 1;

  INSERT INTO public.profiles (user_id, full_name, email, tenant_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    _tenant_id
  );
  RETURN NEW;
END;
$$;
