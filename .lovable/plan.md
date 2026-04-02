

## Fix: Email Alerts Failing with "No Matching Sender Domain"

### Problem

The `send-email-alert` Edge Function has the wrong `sender_domain`. It uses:
- `sender_domain = 'app.churchmanagementsuite.org'` (root domain)

But the verified email domain is:
- `notify.app.churchmanagementsuite.org` (subdomain)

The email API rejects every send with `403 no_matching_sender`, causing all email alerts to DLQ.

### Fix

In `supabase/functions/send-email-alert/index.ts`, change line 199:

```typescript
// Before
const senderDomain = 'app.churchmanagementsuite.org'

// After
const senderDomain = 'notify.app.churchmanagementsuite.org'
```

The `fromDomain` on line 200 can stay as `app.churchmanagementsuite.org` — that's the cosmetic "From:" header domain, which is correct.

Then redeploy the `send-email-alert` Edge Function.

### Files changed
- `supabase/functions/send-email-alert/index.ts` — fix `senderDomain` to verified subdomain

