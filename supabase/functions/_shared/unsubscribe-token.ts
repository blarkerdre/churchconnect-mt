// Shared helper: every transactional email queued to `transactional_emails`
// MUST carry an `unsubscribe_token`, otherwise the email API rejects the send
// with 400 `missing_unsubscribe` and the message eventually dead-letters.
import { createClient } from 'npm:@supabase/supabase-js@2'

type SupabaseClient = ReturnType<typeof createClient>

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export async function getOrCreateUnsubscribeToken(
  supabase: SupabaseClient,
  email: string,
): Promise<string> {
  const normalizedEmail = normalizeEmail(email)

  const { data: existingToken, error: lookupError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalizedEmail)
    .is('used_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (lookupError) throw lookupError
  if (existingToken?.token) return existingToken.token as string

  const token = crypto.randomUUID()
  const { error: insertError } = await supabase
    .from('email_unsubscribe_tokens')
    .upsert({ email: normalizedEmail, token }, { onConflict: 'email', ignoreDuplicates: true })

  if (insertError) throw insertError

  // Another request may have raced us — read back the stored token.
  const { data: storedToken, error: reReadError } = await supabase
    .from('email_unsubscribe_tokens')
    .select('token')
    .eq('email', normalizedEmail)
    .maybeSingle()

  if (reReadError) throw reReadError
  return (storedToken?.token as string) ?? token
}
