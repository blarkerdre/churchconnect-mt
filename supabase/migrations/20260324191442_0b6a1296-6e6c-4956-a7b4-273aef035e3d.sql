
-- Create a SECURITY DEFINER function to check tenant admin status without triggering RLS
CREATE OR REPLACE FUNCTION public.is_tenant_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tenant_memberships
    WHERE user_id = _user_id
      AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  )
$$;

-- Drop the recursive policies
DROP POLICY IF EXISTS "Tenant admins can manage memberships" ON public.tenant_memberships;
DROP POLICY IF EXISTS "Tenant admins can view tenant memberships" ON public.tenant_memberships;

-- Recreate without self-referencing subqueries
CREATE POLICY "Tenant admins can manage memberships"
ON public.tenant_memberships
FOR ALL
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id))
WITH CHECK (is_tenant_admin(auth.uid(), tenant_id));

CREATE POLICY "Tenant admins can view tenant memberships"
ON public.tenant_memberships
FOR SELECT
TO authenticated
USING (is_tenant_admin(auth.uid(), tenant_id));

-- Also fix user_has_tenant_access to use SECURITY DEFINER to avoid recursion
CREATE OR REPLACE FUNCTION public.user_has_tenant_access(_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _tenant_id IS NULL OR EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = auth.uid() AND tenant_id = _tenant_id
  )
$$;
