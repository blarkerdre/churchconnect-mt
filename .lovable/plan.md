

## Fix Course Registration Email Not Sending

### Root Cause
The `send-course-registration-email` edge function has no recent runtime logs, indicating it's either not deployed or not being invoked. The `public-wofbi-register` function (which triggers it) also shows no logs.

### Solution

1. **Redeploy both edge functions**
   - Deploy `public-wofbi-register` and `send-course-registration-email` to ensure the latest code is live

2. **Test the registration flow**
   - Invoke `send-course-registration-email` directly with test data to confirm it works
   - Check logs for any runtime errors (missing secrets, import failures, etc.)

3. **If direct send still fails — migrate to queue-based pattern** (optional improvement)
   - The current function uses `sendLovableEmail` (direct API call). If the API key or send URL has issues, emails silently fail with no retry.
   - Could migrate to the queue-based `enqueue_email` pattern used by other email functions for retry safety, but this is a secondary concern — the immediate fix is redeployment.

### Technical Details
- Files involved: `supabase/functions/send-course-registration-email/index.ts`, `supabase/functions/public-wofbi-register/index.ts`
- No code changes needed initially — just redeployment and verification
- If redeployment doesn't fix it, will inspect runtime logs for the actual error

