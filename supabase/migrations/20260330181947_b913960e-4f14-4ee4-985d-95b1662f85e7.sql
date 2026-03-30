UPDATE email_send_log
SET status = 'failed',
    error_message = 'Stale orphan: resolved by newer log entry for same message'
WHERE status = 'pending'
  AND created_at < now() - interval '30 minutes'
  AND message_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM email_send_log e2
    WHERE e2.message_id = email_send_log.message_id
      AND e2.status IN ('sent', 'failed', 'dlq')
      AND e2.created_at > email_send_log.created_at
  );