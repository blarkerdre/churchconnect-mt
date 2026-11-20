CREATE OR REPLACE FUNCTION public.get_tenant_message_usage(_tenant_id uuid)
 RETURNS TABLE(sms_count bigint, whatsapp_count bigint)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND (public.user_has_tenant_access(_tenant_id) OR public.has_role(auth.uid(), 'super_admin')))
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
  SELECT
    count(*) FILTER (WHERE l.channel = 'sms' AND l.status = 'sent'),
    count(*) FILTER (WHERE l.channel = 'whatsapp' AND l.status = 'sent')
  FROM public.sms_log l
  WHERE l.tenant_id = _tenant_id
    AND l.created_at >= date_trunc('month', now());
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_message_usage(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_message_usage(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_tenant_storage_usage_mb(_tenant_id uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
DECLARE
  v_mb numeric;
BEGIN
  IF NOT (
    auth.role() = 'service_role'
    OR (auth.uid() IS NOT NULL AND (public.user_has_tenant_access(_tenant_id) OR public.has_role(auth.uid(), 'super_admin')))
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  WITH tenant_member_users AS (
    SELECT DISTINCT m.user_id::text AS uid
    FROM public.members m
    WHERE m.tenant_id = _tenant_id AND m.user_id IS NOT NULL
  ),
  sized AS (
    SELECT COALESCE((o.metadata->>'size')::bigint, 0) AS bytes
    FROM storage.objects o
    WHERE
      (
        o.bucket_id IN ('tenant-branding','church-documents','book-covers')
        AND (storage.foldername(o.name))[1] = _tenant_id::text
      )
      OR (
        o.bucket_id = 'profile-photos'
        AND (storage.foldername(o.name))[1] IN (SELECT uid FROM tenant_member_users)
      )
  )
  SELECT ROUND(COALESCE(SUM(bytes), 0)::numeric / (1024 * 1024), 2) INTO v_mb
  FROM sized;

  RETURN v_mb;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_tenant_storage_usage_mb(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage_mb(uuid) TO authenticated, service_role;