

## Fix: Auth Emails Not Rendering — Missing Template Render Step

### Problem

Two issues found:

1. **Emails were disabled again** — Re-enabled now. The most recent email-alert failed with "Emails disabled for this project."

2. **Critical bug: `html` and `text` variables never declared** — In `auth-email-hook/index.ts`, the `enqueue_email` call (line 312-313) passes `html` and `text` in the payload, but the email template is never rendered. There is no `renderAsync()` call between resolving the template (line 211) and enqueuing (line 302). This means auth emails are enqueued with `undefined` content.

   Previous signup emails for `blarkerdre@yahoo.com` show as "sent" in the log, but likely arrived empty or were silently dropped by the email provider.

### Fix

**`supabase/functions/auth-email-hook/index.ts`** — Add template rendering before the enqueue call.

Insert after line 291 (after `messageId` declaration), before the pending log insert:

```typescript
// Build template props
const templateProps: Record<string, any> = {
  siteName: churchName,
  siteUrl: tenantSiteUrl,
  recipient: payload.data.email,
  confirmationUrl: payload.data.confirmation_url || tenantSiteUrl,
}

if (emailType === 'email_change') {
  templateProps.email = payload.data.email
  templateProps.newEmail = payload.data.new_email
}
if (emailType === 'reauthentication') {
  templateProps.token = payload.data.token
}

// Render email HTML and plain text
const html = await renderAsync(React.createElement(EmailTemplate, templateProps))
const text = html.replace(/<[^>]*>/g, '') // basic HTML-to-text fallback
```

Then redeploy `auth-email-hook`.

### Files changed
- `supabase/functions/auth-email-hook/index.ts` — add missing template rendering before enqueue

