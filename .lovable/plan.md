

## Fix: `messageId` Not Defined in auth-email-hook

### Problem

The `auth-email-hook` Edge Function crashes with `ReferenceError: messageId is not defined` at line 294. The variable `messageId` is used in the `email_send_log` insert (line 294) and the `enqueue_email` payload (line 305) but was never declared. This prevents all auth emails (signup, recovery, etc.) from being sent.

### Fix

Add `const messageId = crypto.randomUUID()` before line 292 (the pending log insert), right after the tenant resolution block.

```typescript
// After line 291 (const tenantSiteUrl = ...)
const messageId = crypto.randomUUID()
```

Then redeploy the `auth-email-hook` Edge Function.

### Files changed
- `supabase/functions/auth-email-hook/index.ts` — add missing `messageId` declaration

