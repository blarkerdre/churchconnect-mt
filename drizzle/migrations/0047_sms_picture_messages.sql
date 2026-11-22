ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS units int NOT NULL DEFAULT 1;
ALTER TABLE public.sms_log ADD COLUMN IF NOT EXISTS media_url text;

CREATE OR REPLACE FUNCTION public.sms_units_used(_tenant_id uuid, _channel text, _since timestamptz)
RETURNS bigint LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE WHEN auth.role() = 'service_role' OR public.user_has_tenant_access(_tenant_id) OR public.has_role(auth.uid(),'super_admin')
    THEN (SELECT COALESCE(SUM(units),0) FROM public.sms_log WHERE tenant_id=_tenant_id AND channel=_channel AND status <> 'failed' AND created_at >= _since)
    ELSE 0 END
$$;
REVOKE ALL ON FUNCTION public.sms_units_used(uuid,text,timestamptz) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sms_units_used(uuid,text,timestamptz) TO authenticated, service_role;

CREATE POLICY "sms media upload own tenant" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'sms-media' AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid));
CREATE POLICY "sms media delete own tenant" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'sms-media' AND public.user_has_tenant_access(((storage.foldername(name))[1])::uuid));