UPDATE email_send_log t
SET tenant_id = p.tenant_id
FROM email_send_log p
WHERE t.message_id = p.message_id
  AND t.message_id IS NOT NULL
  AND t.tenant_id IS NULL
  AND p.tenant_id IS NOT NULL
  AND p.status = 'pending'
  AND t.status IN ('sent','failed','dlq','rate_limited');