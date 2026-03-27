
## Fix: Invitation Email Not Actually Sending

### What I found

The invitation record for `blarkerdre@yahoo.com` is still `pending`, and the last app email attempt for that recipient ended in:

- `pending` → `dlq`
- error: **"Emails disabled for this project"**

The sender domain is now verified, but there is still a likely configuration mismatch in the app email sender:

- verified domain: `notify.churchmanagementsuite.org`
- current sender code uses: `notify.app.churchmanagementsuite.org`

That means even after re-sending, future invitation emails may still fail unless the sender config is corrected.

Also, `invite-to-tenant` currently creates the invitation row and calls the app email sender, but it does **not** check whether that send succeeded. So invites can remain pending with no clear feedback.

### Plan

#### 1. Fix the app email sender domain configuration
Update the shared app email sender so it uses the verified sender domain for this project.

**File:**
- `supabase/functions/send-transactional-email/index.ts`

**Change:**
- Replace the hardcoded sender domain with `notify.churchmanagementsuite.org`
- Align the visible From-domain branding if needed

#### 2. Make invitation sending fail loudly instead of silently
Harden the invitation function so it validates the response from the app email sender.

**File:**
- `supabase/functions/invite-to-tenant/index.ts`

**Change:**
- Check the result of the `send-transactional-email` invocation
- If enqueue/send setup fails, return a clear error or warning instead of pretending the invite completed normally
- This prevents “pending forever with no email sent” situations

#### 3. Redeploy the email-related backend functions
After the code updates, redeploy the functions that actually handle invites and email sending.

**Functions:**
- `send-transactional-email`
- `invite-to-tenant`

#### 4. Re-send the current pending invitation
After deployment, re-trigger the invite for `blarkerdre@yahoo.com` so a fresh app email is queued with the corrected sender configuration.

#### 5. Verify end to end
Confirm the fix by checking:
- `email_send_log` shows a new record for `tenant-invitation`
- status progresses successfully instead of going to `dlq`
- the invitation remains `pending` only until the recipient signs up or logs in, which is expected behavior

### Expected outcome

After this fix:
- invitation emails should actually send
- failed email delivery won’t be silently hidden
- the current owner invite can be re-sent successfully
- the invitation row will remain `pending` only until the recipient accepts it by signing in

### Technical notes

```text
Current root cause chain:
invite created
  -> app email sender invoked
  -> previous send failed because project emails were disabled
  -> no resend completed successfully
  -> invitation status stayed pending

Additional risk:
verified domain = notify.churchmanagementsuite.org
current sender code = notify.app.churchmanagementsuite.org
=> likely delivery failure on next resend unless corrected
```

### Files to change

- `supabase/functions/send-transactional-email/index.ts`
- `supabase/functions/invite-to-tenant/index.ts`
