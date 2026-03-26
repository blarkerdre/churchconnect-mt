

## Plan: Send Welcome Email + Admin Notification on Tenant Onboarding

### What We're Building

After a new church completes onboarding via `register-tenant`, two emails are sent:

1. **Welcome email to the new tenant admin** -- congratulates them, provides their login URL and key next steps
2. **Notification email to the platform super admin(s)** -- alerts them that a new tenant has been onboarded with church name, slug, and admin details

### Approach

Both emails will use the existing `send-transactional-email` infrastructure. We create two new templates and invoke them from the `register-tenant` Edge Function after successful tenant creation.

### Changes

**1. New template: `tenant-welcome.tsx`**
- Sent to the new tenant admin
- Props: `name`, `churchName`, `slug`, `loginUrl`
- Content: Welcome message, login URL, quick-start tips (add members, set up registration, configure settings)

**2. New template: `new-tenant-notification.tsx`**
- Sent to platform super admins
- Props: `churchName`, `slug`, `adminName`, `adminEmail`, `createdAt`
- Content: Notification that a new church has been registered with summary details

**3. Update `registry.ts`**
- Import and register both new templates: `tenant-welcome` and `new-tenant-notification`

**4. Update `register-tenant/index.ts`**
- After successful tenant creation (after step 7), invoke `send-transactional-email` twice:
  - Once for the welcome email to `admin_email`
  - Once for the admin notification -- query `user_roles` for `super_admin` users (excluding the new tenant's own admin if they got that role), fetch their emails from `profiles`, and send to each
- Both calls use idempotency keys derived from `tenant.id`

**5. Deploy edge functions**
- Redeploy `send-transactional-email` (new templates) and `register-tenant` (new trigger logic)

### Files Changed

- **`supabase/functions/_shared/transactional-email-templates/tenant-welcome.tsx`** -- new
- **`supabase/functions/_shared/transactional-email-templates/new-tenant-notification.tsx`** -- new
- **`supabase/functions/_shared/transactional-email-templates/registry.ts`** -- add 2 imports
- **`supabase/functions/register-tenant/index.ts`** -- add email sends after step 7

### No database changes needed

