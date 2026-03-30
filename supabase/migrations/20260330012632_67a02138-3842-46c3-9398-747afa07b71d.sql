-- Fix tenant_invitations SELECT policy: use auth.email() instead of auth.users subquery
DROP POLICY IF EXISTS "Users can view own pending invitations" ON public.tenant_invitations;
CREATE POLICY "Users can view own pending invitations"
ON public.tenant_invitations
FOR SELECT TO authenticated
USING (lower(email) = lower(auth.email()));

-- Fix user_roles INSERT policy: use auth.email() instead of auth.users subquery
DROP POLICY IF EXISTS "Users can self-insert role via invitation" ON public.user_roles;
CREATE POLICY "Users can self-insert role via invitation"
ON public.user_roles
FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.tenant_invitations ti
    WHERE lower(ti.email) = lower(auth.email())
    AND ti.tenant_id = user_roles.tenant_id
    AND ti.status = 'pending'
  )
);