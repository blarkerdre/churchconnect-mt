// Shared managed-email senders.
//
// Emails send synchronously through Lovable's managed email API. Delivery,
// retries, suppression, and unsubscribe handling are owned by Lovable — this
// module only sends and mirrors the outcome into the app's `email_send_log`
// table (notification/history only, never send-gating).
import { EmailAPIError, sendLovableEmail } from 'npm:@lovable.dev/email-js@0.1.0'
import type { createClient } from 'npm:@supabase/supabase-js@2'
import {
  sendTemplateEmail,
  type SendTemplateEmailResult,
} from './transactional-email-templates/send-email.ts'

type SupabaseClient = ReturnType<typeof createClient>

// Configuration mirrors the scaffolded send helper.
const SITE_NAME = 'MT-Church Connect'
const SENDER_DOMAIN = 'notify.app.churchmanagementsuite.org'
const FROM_DOMAIN = 'app.churchmanagementsuite.org'

export interface ManagedEmailLogContext {
  supabase: SupabaseClient
  templateName: string
  recipientEmail: string
  tenantId?: string | null
  messageId?: string | null
}

async function logEmailStatus(
  ctx: ManagedEmailLogContext,
  status: 'sent' | 'suppressed' | 'failed',
  errorMessage?: string,
): Promise<void> {
  const { error } = await ctx.supabase.from('email_send_log').insert({
    message_id: ctx.messageId ?? null,
    template_name: ctx.templateName,
    recipient_email: ctx.recipientEmail,
    status,
    ...(errorMessage ? { error_message: errorMessage.slice(0, 1000) } : {}),
    ...(ctx.tenantId ? { tenant_id: ctx.tenantId } : {}),
  })
  if (error) {
    console.error('Failed to write email_send_log row', {
      status,
      code: error.code,
      message: error.message,
    })
  }
}

export interface SendRawManagedEmailArgs {
  supabase: SupabaseClient
  to: string
  subject: string
  html: string
  text?: string
  /** Used as the send label and as `template_name` in email_send_log. */
  label: string
  idempotencyKey?: string
  tenantId?: string | null
  messageId?: string | null
  fromName?: string
  replyTo?: string
}

/**
 * Sends a hand-composed HTML email through Lovable's managed email API.
 * Returns `{ sent: false, reason: 'recipient_suppressed' }` when the recipient
 * previously bounced, complained, or unsubscribed. Any other failure throws.
 */
export async function sendRawManagedEmail(
  args: SendRawManagedEmailArgs,
): Promise<SendTemplateEmailResult> {
  const apiKey = Deno.env.get('LOVABLE_API_KEY')
  if (!apiKey) throw new Error('LOVABLE_API_KEY is not configured')

  const logCtx: ManagedEmailLogContext = {
    supabase: args.supabase,
    templateName: args.label,
    recipientEmail: args.to,
    tenantId: args.tenantId ?? null,
    messageId: args.messageId ?? null,
  }

  const fromName = (args.fromName || SITE_NAME).replace(/["\\]/g, '')

  try {
    await sendLovableEmail(
      {
        to: args.to,
        from: `"${fromName}" <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject: args.subject,
        html: args.html,
        text: args.text,
        purpose: 'transactional',
        label: args.label,
        idempotency_key: args.idempotencyKey || crypto.randomUUID(),
        reply_to: args.replyTo,
      },
      { apiKey, sendUrl: Deno.env.get('LOVABLE_SEND_URL') },
    )
  } catch (error) {
    if (error instanceof EmailAPIError && error.code === 'recipient_suppressed') {
      await logEmailStatus(logCtx, 'suppressed')
      return { sent: false, reason: 'recipient_suppressed' }
    }
    const message = error instanceof Error ? error.message : String(error)
    await logEmailStatus(logCtx, 'failed', message)
    throw error
  }

  await logEmailStatus(logCtx, 'sent')
  return { sent: true }
}

export interface SendLoggedTemplateEmailArgs {
  supabase: SupabaseClient
  templateName: string
  to: string
  templateData?: Record<string, unknown>
  idempotencyKey?: string
  tenantId?: string | null
  messageId?: string | null
  replyTo?: string
}

/**
 * Sends a registered template through the scaffolded managed helper and
 * mirrors the outcome into `email_send_log`.
 */
export async function sendLoggedTemplateEmail(
  args: SendLoggedTemplateEmailArgs,
): Promise<SendTemplateEmailResult> {
  const logCtx: ManagedEmailLogContext = {
    supabase: args.supabase,
    templateName: args.templateName,
    recipientEmail: args.to,
    tenantId: args.tenantId ?? null,
    messageId: args.messageId ?? null,
  }

  let result: SendTemplateEmailResult
  try {
    result = await sendTemplateEmail(args.templateName, args.to, {
      templateData: (args.templateData ?? {}) as Record<string, any>,
      idempotencyKey: args.idempotencyKey,
      replyTo: args.replyTo,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await logEmailStatus(logCtx, 'failed', message)
    throw error
  }

  await logEmailStatus(logCtx, result.sent ? 'sent' : 'suppressed')
  return result
}
