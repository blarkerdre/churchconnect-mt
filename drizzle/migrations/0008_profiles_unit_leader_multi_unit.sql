DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.members m WHERE m.user_id = profiles.user_id AND public.is_admin(auth.uid(), m.tenant_id))
  OR EXISTS (
    SELECT 1 FROM public.members m
    JOIN public.unit_leader_assignments ula
      ON ula.tenant_id = m.tenant_id AND ula.user_id = auth.uid()
     AND lower(trim(ula.unit_name)) IN (SELECT lower(trim(u)) FROM unnest(string_to_array(coalesce(m.church_unit,''), ',')) u)
    WHERE m.user_id = profiles.user_id AND public.has_role(auth.uid(), 'unit_leader'::app_role, m.tenant_id)
  )
);