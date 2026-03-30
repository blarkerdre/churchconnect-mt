

## Fix: Email Failing Due to Comma in Sender Name

### Root cause
The WCI Cardiff tenant has a sender name of `Winners Chapel International, Cardiff`. When this is used in the `from` field as:
```
Winners Chapel International, Cardiff <noreply@app.churchmanagementsuite.org>
```
The comma breaks RFC 5322 email address parsing — the email API interprets it as two separate addresses, causing `Invalid 'from' email address`.

### Fix
In `supabase/functions/send-email-alert/index.ts`, quote the display name in the `from` address to handle special characters:

```typescript
// Before (line 172):
const fromAddress = `${tenantSenderName} <noreply@${fromDomain}>`

// After:
const fromAddress = `"${tenantSenderName.replace(/"/g, '\\"')}" <noreply@${fromDomain}>`
```

This wraps the display name in double quotes (escaping any existing quotes), which is the correct RFC 5322 format for display names containing commas, periods, or other special characters.

### Also check `send-transactional-email`
The same pattern may exist in the transactional email function — will check and fix there too if needed.

### After fix
1. Redeploy `send-email-alert`
2. Send a test email from WCI Cardiff to verify delivery

### Files changed
- `supabase/functions/send-email-alert/index.ts` — quote the `from` display name
- Possibly `supabase/functions/send-transactional-email/index.ts` if same pattern exists

