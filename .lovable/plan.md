

## Plan: Add Tenant Onboarding Invitation & Auth URL Display to Tenant Admin

### What We're Building

1. **Invite New Tenant for Onboarding** -- A button/dialog that lets super admins send an onboarding invitation email to a new church admin, pre-filling the onboard flow. Since the existing `invite-to-tenant` edge function handles inviting users to *existing* tenants, this is a different concept: generating/sharing the onboarding URL (`/onboard`) for a new church to self-register.

2. **Tenant Auth URL Display** -- For each tenant row in the table, show/copy the tenant-specific authentication URL (e.g., `/t/:slug/auth`) so admins can share login links with church members.

### Changes

**File: `src/pages/TenantAdmin.jsx`**

1. **Add "Invite to Onboard" button** next to "New Tenant" button in the header area:
   - Opens a small dialog with the onboarding URL (`{origin}/onboard`) displayed with a copy-to-clipboard button
   - Optionally includes an email input to share the link (using a simple `mailto:` link with pre-filled subject/body containing the onboard URL)

2. **Add Auth URL column/action to tenant table rows**:
   - For each active tenant, add a small "Auth URL" button/icon that shows a popover or copies `/t/{slug}/auth` to clipboard
   - Also show the public registration URL: `/t/{slug}/register`
   - Both URLs include `window.location.origin` prefix for the full URL
   - Use a `Copy` icon with toast confirmation on click

3. **Import additions**: Add `Link`, `Copy`, `ExternalLink` from lucide-react

### UI Details

- **Onboard invite dialog**: Simple card with the onboarding URL displayed in a code block, a "Copy Link" button, and a "Send via Email" mailto link
- **Tenant URLs**: A popover (triggered by a link icon in the actions column) showing:
  - Login URL: `{origin}/t/{slug}/auth`
  - Registration URL: `{origin}/t/{slug}/register`
  - Each with individual copy buttons

### No database or migration changes needed

