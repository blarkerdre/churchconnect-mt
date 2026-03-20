

## Fix: Welcome Email Not Sending After QR Code Registration

### Root Cause
The `send-welcome-email` Edge Function calls `supabase.rpc("enqueue_email", { queue_name: "transactional_emails", ... })` but the pgmq queue `transactional_emails` does not exist. No emails queued this way will ever be sent.

### Solution
Set up the email queue infrastructure using the email infrastructure tool, which creates:
- pgmq queues (`transactional_emails`, `auth_emails`, and their DLQs)
- The `email_send_state` config table
- A pg_cron job to process the queue every 5 seconds via the `process