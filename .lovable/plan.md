

## Fix: Email Verification Link Missing from Auth Emails

### Problem

Edge function logs confirm the root cause:

```
confirmationUrl: "https://app.churchmanagementsuite.org/t/demo-test"
rawConfirmationUrl: undefined
```

The `confirmation_url` field in `payload.data.confirmation_url` is `undefined` — it doesn't exist in the Lovable email webhook payload. The template falls back to the bare site URL, which has no verification token. Clicking it just loads the homepage without confirming the email.

The current `auth-email-hook` was manually modified over multiple iterations and is now out of sync with the expected webhook payload structure from `@lovable.dev/email-js` and `@lovable.dev/webhooks-js`.

### Fix: Re-scaffold the auth-email-hook

The safest fix is to re-scaffold the `auth-email-hook` using the scaffolding tool, which generates code that correctly maps the webhook payload fields (including the confirmation URL). After re-scaffolding:

1. **Re-apply tenant-scoped customizations** — The scaffolded hook uses a generic site name. We need to re-add:
   - Tenant resolution logic (lookup tenant from user's membership/metadata)
   - Dynamic `churchName` and tenant-scoped URLs in template props
   - The diagnostic logging we added previously

2. **Re-apply brand styling** to the email templates to match the existing look (navy `#1a2d4d` primary, cream `#faf8f5` background, Playfair Display headings).

3. **Redeploy** the edge function.

### Steps

1. Call `scaffold_auth_email_templates` (with overwrite) to get a fresh hook with correct payload mapping
2. Read the re-scaffolded `index.ts` to understand the correct payload field names
3. Re-add tenant resolution and scoped branding on top of the scaffolded code
4. Re-apply existing brand styles to templates
5. Deploy `auth-email-hook`

### Files changed
- `supabase/functions/auth-email-hook/index.ts` — re-scaffold + re-add tenant customizations
- `supabase/functions/_shared/email-templates/*.tsx` — re-apply brand styling

