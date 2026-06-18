
CREATE OR REPLACE FUNCTION public.is_child_primary_guardian(_user_id uuid, _child_id uuid, _tenant_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.children c
    JOIN public.members m ON m.id = c.primary_guardian_member_id
    WHERE c.id = _child_id
      AND c.tenant_id = _tenant_id
      AND m.tenant_id = _tenant_id
      AND (
        m.user_id = _user_id
        OR lower(m.email) = (SELECT lower(email) FROM auth.users WHERE id = _user_id)
      )
  );
$function$;

DROP POLICY IF EXISTS "Child guardians manage" ON public.child_guardians;

CREATE POLICY "Child guardians manage"
ON public.child_guardians
FOR ALL
TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_children_church_member(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR public.is_child_co_parent(auth.uid(), child_id, tenant_id)
);
