

## Fix: Email Verification Link Debugging and Reliability

### Problem

The signup verification email for `blarkerdre@yahoo.com` was delivered (confirmed `sent` in logs) but clicking the link didn't confirm the email. The user account no longer exists, so we can't retroactively inspect the URL. Two likely causes:

1. **No diagnostic logging** — the `confirmation_url` passed to the template is never logged, making it impossible to debug
2. **Token expiry** — auth emails go through pgmq async queue; if processing is delayed, the OTP token in the URL may expire (default: 1 hour, auth email TTL: 15 min — so this is unlikely but possible)

### Changes

#### 1. `supabase/functions/auth-email-hook/index.ts` — Add diagnostic logging

After building `templateProps` (line 299), log the confirmation URL so future issues can be diagnosed:

```typescript
console.log('Auth email template props', {
  run_id,
  emailType,
  email: payload.data.email,
  confirmationUrl: templateProps.confirmationUrl,
  rawConfirmationUrl: payload.data.confirmation_url,
  tenantId: resolvedTenantId,
  churchName,
})
```

#### 2. Redeploy `auth-email-hook`

Deploy the updated function so logs are captured on the next signup.

#### 3. Test with a fresh signup

After deploying, the user should sign up a test account and:
- Check the edge function logs for the `confirmationUrl` value
- Click the link and verify it confirms the email

### Files changed
- `supabase/functions/auth-email-hook/index.ts` — add confirmation URL logging
- Redeploy `auth-email-hook`

