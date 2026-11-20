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
    count(*) FILTER (WHERE l.channel = 'sms' AND l.status IS DISTINCT FROM 'failed'),
    count(*) FILTER (WHERE l.channel = 'whatsapp' AND l.status IS DISTINCT FROM 'failed')
  FROM public.sms_log l
  WHERE l.tenant_id = _tenant_id
    AND l.created_at >= date_trunc('month', now());
END;
$function$;