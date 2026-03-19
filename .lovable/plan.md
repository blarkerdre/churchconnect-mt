

## Send Welcome Email on QR Code Registration

### Current State
Public registration via QR code (`/register`) creates a member record only — no email is sent. The project has email infrastructure (auth-email-hook, process-email-queue, pgmq queues) but no transactional email template for welcome/registration confirmation.

### What We'll Build
After a successful public registration, send a branded welcome email to the new member (if they provided an email address).

### How

**1. Create a welcome email template**
- Add `supabase/functions/_shared/email-templates/welcome-registration.tsx` — a React Email template branded with Winners Chapel styling (#1a2d4d, Playfair Display headings)
- Content: "Welcome to Winners Chapel International Cardiff", confirm their registration was received, invite them to create an account at the login page, and include church contact info

**2. Create a `send-welcome-email` Edge Function**
- New function at `supabase/functions/send-welcome-email/index.ts`
- Accepts `{ email, first_name, last_name }` from the public-register function
- Renders the welcome template and enqueues it via `enqueue_email` RPC to the `transactional_emails` queue
- Logs to `email_send_log`
- Set `verify_jwt = false` in config.toml (called server-side from public-register)
- Validate caller using service role key header check

**3. Update `public-register` Edge Function**
- After successful member insert/update/claim, if the member provided an email, call `send-welcome-email` internally via `fetch` (same Supabase functions URL)
- Pass the service role key as Authorization header
- Fire-and-forget (don't block registration response on email delivery)

**4. Config & Deploy**
- Add `send-welcome-email` to `supabase/config.toml` with `verify_jwt = false`
- Deploy both `send-welcome-email` and `public-register` Edge Functions

### Files Modified
1. `supabase/functions/_shared/email-templates/welcome-registration.tsx` — new template
2. `supabase/functions/send-welcome-email/index.ts` — new Edge Function
3. `supabase/functions/public-register/index.ts` — trigger welcome email after registration
4. `supabase/config.toml` — add send-welcome-email config

