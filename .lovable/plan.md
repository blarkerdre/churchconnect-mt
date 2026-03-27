

## Fix: Invitation Emails + Auto-Accept on Signup

### Problem

When you invite a new user (like `blarkerdre@yahoo.com`) to a tenant, the system only creates a `tenant_invitations` record — it **never sends an email**. The recipient has no idea they were invited, so the invitation stays "pending" forever.

### Solution

Three changes to make the invitation flow work end-to-end:

#### 1. Send invitation email from `invite-to-tenant` Edge Function

After creating the invitation record, call `send-transactional-email` with a new `tenant-invitation` template. The email includes a signup link pointing to the tenant's auth page (e.g., `https://app.churchmanagementsuite.org/t/{slug}/auth`).

#### 2. Create `tenant-invitation` transactional email template

A new React Email template in `_shared/transactional-email-templates/tenant-invitation.tsx` that says "You've been invited to join {churchName}" with a button linking to the tenant's signup page. Register it in `registry.ts`.

#### 3. Auto-accept pending invitations on login

Update `TenantContext.jsx` to check for pending invitations matching the logged-in user's email after authentication. If found, automatically create the `tenant_membership`, mark the invitation as `accepted`, and refresh memberships. This handles both new signups and existing users who log in.

### Immediate fix for the current invite

As part of implementation, resend the invitation email to `blarkerdre@yahoo.com` by re-invoking the updated edge function (or manually triggering the transactional email).

### Files changed

- **`supabase/functions/invite-to-tenant/index.ts`** — fetch tenant slug/name, call `send-transactional-email` after creating invitation
- **`supabase/functions/_shared/transactional-email-templates/tenant-invitation.tsx`** — new invitation email template
- **`supabase/functions/_shared/transactional-email-templates/registry.ts`** — register new template
- **`src/contexts/TenantContext.jsx`** — add post-login invitation acceptance logic
- **Deploy**: `send-transactional-email`, `invite-to-tenant`

