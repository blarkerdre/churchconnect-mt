UPDATE public.email_send_log AS t
SET tenant_id = src.tenant_id
FROM (
  SELECT DISTINCT ON (message_id) message_id, tenant_id
  FROM public.email_send_log
  WHERE tenant_id IS NOT NULL AND message_id IS NOT NULL
  ORDER BY message_id, created_at ASC
) AS src
WHERE t.message_id = src.message_id
  AND t.tenant_id IS NULL;