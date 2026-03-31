UPDATE public.email_send_log AS target
SET tenant_id = source.tenant_id
FROM public.email_send_log AS source
WHERE target.message_id IS NOT NULL
  AND target.tenant_id IS NULL
  AND target.status IN ('sent', 'failed', 'dlq', 'rate_limited')
  AND source.message_id = target.message_id
  AND source.status = 'pending'
  AND source.tenant_id IS NOT NULL;