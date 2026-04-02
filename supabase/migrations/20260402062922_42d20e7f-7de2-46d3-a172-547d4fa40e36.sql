-- Fix 1: user_roles self-insert escalation - constrain inserted role to match invitation
DROP POLICY IF EXISTS "Users can self-insert role via invitation" ON public.user_roles;

CREATE POLICY "Users can self-insert role via invitation" ON public.user_roles
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tenant_invitations ti
      WHERE lower(ti.email) = lower(auth.email())
        AND ti.status = 'pending'
        AND ti.tenant_id = user_roles.tenant_id
        AND ti.role = user_roles.role::text
    )
  );

-- Fix 2: scheduled_communications - restrict to admins only
DROP POLICY IF EXISTS "Tenant admins can insert scheduled communications" ON public.scheduled_communications;
DROP POLICY IF EXISTS "Tenant admins can update scheduled communications" ON public.scheduled_communications;
DROP POLICY IF EXISTS "Tenant admins can delete scheduled communications" ON public.scheduled_communications;

CREATE POLICY "Admins can manage scheduled communications" ON public.scheduled_communications
  FOR ALL TO authenticated
  USING (public.is_admin(auth.uid(), tenant_id))
  WITH CHECK (public.is_admin(auth.uid(), tenant_id));