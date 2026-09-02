import { createEmailWebhookHandler } from 'npm:@lovable.dev/email-js@0.1.0'
import { createClient } from 'npm:@supabase/supabase-js@2'

// Lovable enforces suppression server-side at send time. These app-table
// writes are a history/notification view only — they never gate sends.
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const REASON_STATUS: Record<string, 'bounced' | 'complained' | 'suppressed'> = {
  bounce: 'bounced',
  complaint: 'complained',
  unsubscribe: 'suppressed',
}

const REASON_MESSAGE: Record<string, string> = {
  bounce: 'Permanent bounce — email address is invalid or rejected',
  complaint: 'Spam complaint — recipient marked email as spam',
  unsubscribe: 'Recipient unsubscribed',
}

async function recordOutcome(
  reason: 'bounce' | 'complaint' | 'unsubscribe',
  recipient: string,
  messageId: string | null,
  eventId: string,
) {
  const supabase = createClient(supabaseUrl, supabaseServiceKey)
  const email = String(recipient || '').toLowerCase()
  if (!email) return

  const { error: suppressError } = await supabase
    .from('suppressed_emails')
    .upsert({ email, reason, metadata: null }, { onConflict: 'email' })

  if (suppressError) {
    console.error('Failed to upsert suppressed email', {
      event_id: eventId,
      code: suppressError.code,
      message: suppressError.message,
    })
    throw new Error('Failed to record suppression')
  }

  const { error: logError } = await supabase.from('email_send_log').insert({
    message_id: messageId,
    template_name: 'system',
    recipient_email: email,
    status: REASON_STATUS[reason],
    error_message: REASON_MESSAGE[reason],
    metadata: null,
  })

  if (logError) {
    console.error('Failed to insert email_send_log', {
      event_id: eventId,
      code: logError.code,
      message: logError.message,
    })
    throw new Error('Failed to record email log')
  }
}

const handler = createEmailWebhookHandler({
  apiKey: Deno.env.get('LOVABLE_API_KEY')!,
  on: {
    'email.bounced': async (event) => {
      await recordOutcome(
        'bounce',
        event.data.recipient,
        event.data.message_id ?? null,
        event.event_id,
      )
    },
    'email.complaint': async (event) => {
      await recordOutcome(
        'complaint',
        event.data.recipient,
        event.data.message_id ?? null,
        event.event_id,
      )
    },
    'email.unsubscribed': async (event) => {
      await recordOutcome(
        'unsubscribe',
        event.data.recipient,
        event.data.message_id ?? null,
        event.event_id,
      )
    },
  },
})

Deno.serve((req) => handler(req))
