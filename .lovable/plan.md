

## Fix: Emails Stuck as "Pending" — Invalid 'from' Address

### Root cause

The `send-email-alert` edge function constructs the `from` address using the **sender subdomain** (`notify.app.churchmanagementsuite.org`), but the Lovable email API expects the `from` address to use the **root/display domain** (`app.churchmanagementsuite.org`). The `sender_domain` field is correctly set to the subdomain for routing, but the `from` header must use the display domain — exactly how `send-transactional-email` does it.

Current (broken):
```
from: "Winners Chapel International Cardiff <noreply@notify.app.churchmanagementsuite.org>"
```

Expected (working):
```
from: "Winners Chapel International Cardiff <noreply@app.churchmanagementsuite.org>"
```

### Fix

**Edit `supabase/functions/send-email-alert/index.ts`:**

- Change `fromAddress` to use `app.churchmanagementsuite.org` (the FROM_DOMAIN) instead of `notify.app.churchmanagementsuite.org` (the SENDER_DOMAIN)
- Keep `sender_domain` as `notify.app.churchmanagementsuite.org` in the payload (this is correct for routing)

This matches the pattern used by `send-transactional-email` (line 324):
```
from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`  // FROM_DOMAIN = app.churchmanagementsuite.org
sender_domain: SENDER_DOMAIN                     // notify.app.churchmanagementsuite.org
```

### Files changed
1. `supabase/functions/send-email-alert/index.ts` — fix `fromAddress` domain

### Expected result
Queued emails will process successfully and be delivered instead of failing with "Invalid 'from' email address".

