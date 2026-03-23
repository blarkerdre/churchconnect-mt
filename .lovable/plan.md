

## Send Course Registration Confirmation Email

### What happens now
- New members get a generic welcome email when they first register via the public form
- Existing members who register for a course get NO email notification
- The welcome email doesn't mention which course they registered for

### What changes

**1. New email template** — `supabase/functions/_shared/email-templates/wofbi-course-registration.tsx`
- Branded React Email component matching existing style (#1a2d4d header, Georgia font)
- Shows the registrant's name and the course they registered for
- Includes a "Visit Dashboard" CTA button

**2. Update `public-wofbi-register` edge function** — Add a fire-and-forget call to `send-welcome-email` style function for course confirmation
- Since the project uses direct email sending (not the transactional queue pattern), create a new `send-course-registration-email` edge function following the same pattern as `send-welcome-email`
- Trigger it for ALL successful registrations (both new and existing members)
- Pass `email`, `first_name`, `course_name` to the function

**3. New edge function** — `supabase/functions/send-course-registration-email/index.ts`
- Follows identical pattern to `send-welcome-email`: renders the React Email template, sends via `@lovable.dev/email-js`, logs to `email_send_log`
- Accepts `email`, `first_name`, `course_name`

**4. Config update** — Add `verify_jwt = false` for the new function in `supabase/config.toml`

### Technical details
- Reuses the existing direct-send email pattern (no new infrastructure needed)
- The course registration email fires for every successful registration, replacing the new-member-only welcome email trigger in the WoFBI flow
- The general welcome email for new members still fires separately as before

