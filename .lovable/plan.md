

## Fix: Confirmation Emails Link to Wrong Tenant

### Problem

The welcome registration and course registration confirmation emails contain a "Create Your Account" / "Visit Dashboard" button that links to `${siteUrl}/auth` — which resolves to `https://app.churchmanagementsuite.org/auth` (bare, no tenant slug). Users clicking this land on the wrong tenant.

Three places need fixing:

1. **`triggerWelcomeEmail()` in `public-register/index.ts`** — doesn't pass `tenant_id` or `tenant_slug`
2. **`triggerWelcomeEmail()` in `public-wofbi-register/index.ts`** — same issue
3. **`triggerCourseRegistrationEmail()` in `public-wofbi-register/index.ts`** — same issue
4. **`send-welcome-email/index.ts`** — hardcodes `siteUrl` to `ROOT_DOMAIN`, doesn't resolve tenant slug
5. **`send-course-registration-email/index.ts`** — same hardcoded `siteUrl`
6. **Email templates** (`welcome-registration.tsx`, `wofbi-course-registration.tsx`) — button href uses `${siteUrl}/auth` instead of tenant-scoped `/t/{slug}/auth`

### Fix

**1. Edge function callers** — pass `tenant_id` (and optionally `tenant_slug`) in the email trigger body:
- `public-register/index.ts`: already has `tenantId` in scope — pass it to `triggerWelcomeEmail`
- `public-wofbi-register/index.ts`: pass `tenant_id` to both trigger functions

**2. `send-welcome-email/index.ts` and `send-course-registration-email/index.ts`** — when `tenant_id` is provided, look up the tenant's `slug` and build `siteUrl` as `https://${ROOT_DOMAIN}/t/${slug}` so the button links to the correct tenant auth page.

**3. Email templates** — no template changes needed; they already use `${siteUrl}/auth`, so fixing `siteUrl` in the edge functions is sufficient.

### Files changed
- `supabase/functions/public-register/index.ts` — pass `tenant_id` to `triggerWelcomeEmail`
- `supabase/functions/public-wofbi-register/index.ts` — pass `tenant_id` to both email triggers
- `supabase/functions/send-welcome-email/index.ts` — resolve tenant slug, build tenant-scoped `siteUrl`
- `supabase/functions/send-course-registration-email/index.ts` — same tenant-scoped `siteUrl` fix

