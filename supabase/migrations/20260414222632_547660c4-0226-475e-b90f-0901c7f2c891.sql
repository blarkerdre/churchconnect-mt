
-- 1. Create security definer function to check unit leader membership
CREATE OR REPLACE FUNCTION public.is_unit_leader_for_member(
  _user_id uuid, _church_unit text, _tenant_id uuid
) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_leader_assignments ula
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND position(lower(ula.unit_name) in lower(COALESCE(_church_unit, ''))) > 0
  )
$$;

-- 2. Drop the broad SELECT policy
DROP POLICY IF EXISTS "Admins and leaders can view all members" ON public.members;

-- 3. Create separate admin SELECT policy
CREATE POLICY "Admins can view all members"
ON public.members
FOR SELECT
TO authenticated
USING (public.is_admin(auth.uid(), tenant_id));

-- 4. Create unit leader SELECT policy (scoped to their units)
CREATE POLICY "Unit leaders can view unit members"
ON public.members
FOR SELECT
TO authenticated
USING (
  public.is_unit_leader_for_member(auth.uid(), church_unit, tenant_id)
  AND public.user_has_tenant_access(tenant_id)
);

-- 5. Drop the broad UPDATE policy
DROP POLICY IF EXISTS "Admins and leaders can update members" ON public.members;

-- 6. Create separate admin UPDATE policy
CREATE POLICY "Admins can update members"
ON public.members
FOR UPDATE
TO authenticated
USING (public.is_admin(auth.uid(), tenant_id))
WITH CHECK (public.is_admin(auth.uid(), tenant_id));

-- 7. Create unit leader UPDATE policy (scoped to their units)
CREATE POLICY "Unit leaders can update unit members"
ON public.members
FOR UPDATE
TO authenticated
USING (
  public.is_unit_leader_for_member(auth.uid(), church_unit, tenant_id)
  AND public.user_has_tenant_access(tenant_id)
)
WITH CHECK (
  public.is_unit_leader_for_member(auth.uid(), church_unit, tenant_id)
  AND public.user_has_tenant_access(tenant_id)
);
