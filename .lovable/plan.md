

## Fix: Email-Alert Emails Failing with "Invalid 'from' email address"

### Problem
Email-alert messages are stuck as `pending`/`failed` because the `send-email-alert` edge function uses mismatched domains:
- `sender_domain` = `notify.app.churchmanagementsuite.org` (not a configured domain)
- `from` address = `noreply@app.churchmanagementsuite.org`

The email API rejects this because the `from` domain doesn't match the `sender_domain`, and `notify.app.churchmanagementsuite.org` isn't a verified domain anyway. The verified domain is `app.churchmanagementsuite.org`.

### Fix
In `supabase/functions/send-email-alert/index.ts`, change lines 199-202:

```
Before:
  const senderDomain = 'notify.app.churchmanagementsuite.org'
  const fromDomain = 'app.churchmanagementsuite.org'

After:
  const senderDomain = 'app.churchmanagementsuite.org'
  const fromDomain = 'app.churchmanagementsuite.org'
```

Both values must use the verified domain `app.churchmanagementsuite.org`.

### Build error (AWS CLI)
The `dist upload failed: aws s3 cp exit 127` error is the same Nix/AWS CLI infrastructure issue from earlier — it requires re-installing the AWS CLI binary, not a code change. I will fix this after deploying the edge function update.

### Files changed
- `supabase/functions/send-email-alert/index.ts` — fix `senderDomain` to match the verified email domain

