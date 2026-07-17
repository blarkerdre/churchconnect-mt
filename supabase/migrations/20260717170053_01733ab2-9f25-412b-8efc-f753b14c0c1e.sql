
-- 1) exam_questions policy scoped to authenticated role only
DROP POLICY IF EXISTS "Admins can manage exam questions" ON public.exam_questions;
CREATE POLICY "Admins can manage exam questions"
ON public.exam_questions
FOR ALL
TO authenticated
USING (is_admin(auth.uid(), tenant_id))
WITH CHECK (is_admin(auth.uid(), tenant_id));

-- 2) Remove email fallback in is_child_primary_guardian (strict user_id match only)
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
      AND m.user_id = _user_id
  );
$function$;

-- 3) Harden is_wsf_leader_for_centre with explicit tenant scoping
CREATE OR REPLACE FUNCTION public.is_wsf_leader_for_centre(_user_id uuid, _centre_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.wsf_centres wc
    JOIN public.members m ON m.id = wc.leader_id
    WHERE wc.id = _centre_id
      AND m.user_id = _user_id
      AND m.tenant_id = wc.tenant_id
      AND public.user_has_tenant_access(wc.tenant_id)
  );
$function$;
