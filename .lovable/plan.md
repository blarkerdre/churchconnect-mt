## Goal
Allow a person who already has a Lovable Cloud account (from Tenant A) to accept an admin's invitation to Tenant B by signing in with their existing email/password — no second signup required.

## Current gap
- `invite-to-tenant` already auto-adds an invitee if their email matches an existing `profiles` row (creates the `tenant_memberships` row directly). Good.
- But when the invitee is invited under an email that is NOT yet in `profiles`, we create a `tenant_invitations` row and email them a link to `/t/:slug/auth`. That page today only supports signup or password-reset. If they already have an account under that email, the flow gets confusing:
  - They can log in, but `acceptPendingInvitations` in `TenantContext` calls `accept_tenant_invitation` RPC — this already works IF the invite email matches the logged-in user's email.
- However, an admin may invite `alice@work.com` while Alice's existing account is `alice@personal.com`. Today there's no way for her to claim that invite with her existing credentials.
- There is also no explicit "Accept Invitation" UI: users must guess to sign in on the tenant auth page.

## What to build

### 1. Dedicated accept-invitation page
New route: `/accept-invite?token=<invitation_token>`

- Public route (no tenant slug required).
- Loads the invitation via a new SECURITY DEFINER RPC `get_invitation_details(_token uuid)` that returns `{ tenant_name, tenant_slug, email, role, status, expired }` for pending invites only.
- Shows: "You've been invited to join **{Tenant Name}** as {role} (invited email: {email})."
- Three action states:
  - **Not signed in** → two tabs:
    - *Sign in with existing account* (email + password). After login, auto-accept.
    - *Create new account* (deep-links to `/t/:slug/auth` signup, prefilled email).
  - **Signed in, email matches invitation** → single "Accept invitation" button.
  - **Signed in, email does NOT match invitation** → banner: "This invitation was sent to {invite.email}, but you're signed in as {user.email}." Offer:
    - "Accept anyway with this account" (links current auth user to the invite's tenant, ignoring the email mismatch — admin-approved by definition since they sent it).
    - "Sign out and use a different account."

### 2. New RPC: `accept_tenant_invitation_by_token`
- SECURITY DEFINER.
- Params: `_token uuid`, `_allow_email_mismatch boolean default false`.
- Validates invitation is pending & not expired.
- If email matches `auth.email()` OR `_allow_email_mismatch` is true, insert into `tenant_memberships` (on-conflict update role), mark invitation `accepted`, and if a `members` row exists in that tenant with the invitee's email but no `user_id`, link it (mirrors `auto_link_member_by_email` scoped to that tenant).
- Returns `{ tenant_slug }` so the client can redirect to `/t/:slug`.

### 3. Update invitation email
`invite-to-tenant` currently sends `signupUrl = /t/:slug/auth`. Change to `acceptUrl = /accept-invite?token=<invitation.id>`. Email copy: "Accept your invitation — sign in with your existing account or create a new one."

### 4. Update `TenantContext.acceptPendingInvitations`
Keep as-is for the common case (same email). No change needed — the new flow supplements it.

### 5. Tenant switcher hint
When a user has more than one tenant membership, no change needed — `TenantContext` already picks up the new membership on next refresh. After accepting, call `refreshTenantContext()` and navigate to `/t/:new-slug`.

## Files to change / add

- `supabase/migrations/<new>.sql` — `get_invitation_details` + `accept_tenant_invitation_by_token` RPCs.
- `src/pages/AcceptInvite.jsx` — new page.
- `src/App.jsx` — register `/accept-invite` route (public, outside tenant layout).
- `supabase/functions/invite-to-tenant/index.ts` — swap `signupUrl` for `acceptUrl` using invitation id as token; update template data key if needed.
- `supabase/functions/_shared/email-templates/invite.tsx` (or whichever `tenant-invitation` template is in use) — minor copy tweak: "sign in or sign up to accept."

## Non-goals
- No change to the existing auto-add path (existing profile email match still short-circuits directly to `tenant_memberships`).
- No change to `auto_link_member_by_email` on signup.
- No cross-tenant password sharing / SSO changes — Supabase Auth already has one global identity per email.

## Security
- Token = `tenant_invitations.id` (uuid). Invitation is single-use and status-guarded.
- Email-mismatch acceptance is allowed because the admin explicitly issued the invite for that tenant; the accepting user must still be authenticated and must possess the token from the emailed link.
- RLS on `tenant_memberships` untouched; RPC is SECURITY DEFINER with `search_path = public`.
