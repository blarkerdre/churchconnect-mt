CREATE OR REPLACE FUNCTION public.current_user_in_tenant_text(_tenant text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.tenant_memberships
                 WHERE user_id = auth.uid() AND tenant_id::text = _tenant)
      OR public.has_role(auth.uid(), 'super_admin'::app_role)
$$;
REVOKE EXECUTE ON FUNCTION public.current_user_in_tenant_text(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_user_in_tenant_text(text) TO authenticated;

DROP POLICY IF EXISTS "Statements and certificates need current membership" ON storage.objects;
CREATE POLICY "Statements and certificates need current membership" ON storage.objects
AS RESTRICTIVE FOR SELECT TO authenticated
USING (
  NOT (bucket_id = 'exam-statements'
       OR (bucket_id = 'church-documents' AND (storage.foldername(name))[2] = 'certificates'))
  OR public.current_user_in_tenant_text((storage.foldername(name))[1])
);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['teens','preteens','trivia_attempts','trivia_answers','wofbi_feedback_responses','unit_join_requests'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Requires current church membership" ON public.%I', t);
    EXECUTE format($p$CREATE POLICY "Requires current church membership" ON public.%I
      AS RESTRICTIVE FOR ALL TO authenticated
      USING (public.user_has_tenant_access(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role))
      WITH CHECK (public.user_has_tenant_access(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role))$p$, t);
  END LOOP;
END $$;