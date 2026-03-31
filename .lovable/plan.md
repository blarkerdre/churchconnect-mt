

## Fix: `Invalid 'from' email address` in Welcome Email

### Root cause

The `from` field on line 164 is built as:
```
${senderName} <noreply@app.churchmanagementsuite.org>
```

If `senderName` contains a comma (e.g. `"Winners Chapel International, Cardiff"`), the resulting string violates RFC 5322 email address format. The email API rejects it as `invalid_email`.

The project's own memory note confirms this pattern: *"To prevent parsing failures for church names containing commas, all `from` display names are wrapped in escaped double quotes."*

### Fix

**`supabase/functions/send-welcome-email/index.ts`** — Wrap `senderName` in double quotes in the `from` field:

```ts
from: `"${senderName.replace(/"/g, '')}" <noreply@${FROM_DOMAIN}>`,
```

This strips any existing double quotes from the name (to prevent injection) then wraps it, making the address RFC-compliant regardless of commas or special characters.

**`supabase/functions/send-course-registration-email/index.ts`** — Apply the same fix if it has the same unquoted pattern.

### Files changed
- `supabase/functions/send-welcome-email/index.ts` — quote the `from` display name
- `supabase/functions/send-course-registration-email/index.ts` — same fix (if applicable)

