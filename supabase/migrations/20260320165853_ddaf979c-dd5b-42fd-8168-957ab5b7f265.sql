-- Delete stuck messages that are missing run_id (old format certificate emails)
DELETE FROM pgmq.q_transactional_emails 
WHERE message->>'run_id' IS NULL 
  AND message->>'purpose' = 'transactional';