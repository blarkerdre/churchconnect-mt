-- Backfill tenant_id on terminal email_send_log rows from their pending sibling
-- so System Logs dedup (tenant-scoped) shows the latest status.
UPDATE public.email_send_log t
SET tenant_id = p.tenant_id
FROM public.email_send_log p
WHERE t.tenant_id IS NULL
  AND t.message_id IS NOT NULL
  AND p.message_id = t.message_id
  AND p.tenant_id IS NOT NULL;
