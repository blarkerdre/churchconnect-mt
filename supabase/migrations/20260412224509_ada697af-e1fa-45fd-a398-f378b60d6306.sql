DROP POLICY "Service role can insert testimonies" ON public.testimonies;

CREATE POLICY "Authenticated users can insert own testimonies"
  ON public.testimonies FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id AND user_has_tenant_access(tenant_id));