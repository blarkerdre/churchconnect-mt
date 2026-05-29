
DROP POLICY IF EXISTS "Users can accept invitations for themselves" ON public.tenant_memberships;

CREATE POLICY "Users can accept invitations for themselves"
ON public.tenant_memberships
FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1
    FROM public.tenant_invitations ti
    WHERE lower(ti.email) = lower((
      SELECT users.email FROM auth.users WHERE users.id = auth.uid()
    )::text)
    AND ti.tenant_id = tenant_memberships.tenant_id
    AND ti.status = 'pending'
    AND ti.role::text = tenant_memberships.role::text
  )
);
