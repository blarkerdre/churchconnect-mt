-- 1. Tighten followup_referrals DELETE policy
DROP POLICY IF EXISTS "Delete referrals: admins or referrer" ON public.followup_referrals;
CREATE POLICY "Delete referrals: admins or referrer"
ON public.followup_referrals
FOR DELETE
TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR (referred_by = auth.uid() AND public.user_belongs_to_tenant(auth.uid(), tenant_id))
);

-- 2. Allow tenant admins to read suppressed emails for their tenant
CREATE POLICY "Tenant admins can read suppressed emails"
ON public.suppressed_emails
FOR SELECT
TO authenticated
USING (
  tenant_id IS NOT NULL AND public.is_admin(auth.uid(), tenant_id)
);