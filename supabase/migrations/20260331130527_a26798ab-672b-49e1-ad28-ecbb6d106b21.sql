UPDATE email_send_log target
SET tenant_id = source.tenant_id
FROM email_send_log source
WHERE target.message_id = source.message_id
  AND target.tenant_id IS NULL
  AND source.tenant_id IS NOT NULL
  AND source.status = 'pending'
  AND target.status IN ('sent', 'failed', 'dlq', 'rate_limited');