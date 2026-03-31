

## Fix: Tenant and User Mismatch on QR Registration

### Root cause

Two issues combine to cause cross-tenant member linking:

1. **QR code URL fallback**: `RegistrationQRCode.jsx` (line 13-15) falls back to `/register` (no slug) when `tenantSlug` is null. This means the registration page resolves to `DEFAULT_TENANT_ID` instead of the admin's actual tenant — registering the person into the wrong church.

2. **Email-based member claim without `auth.users` verification**: In `public-register/index.ts` (lines 392-429), when an authenticated user scans the QR, the function searches for existing members by email and sets `user_id` on the match. If the referenced `auth.users` row was deleted, this trips the `members_user_id_fkey` FK constraint. Additionally, if `tenantId` happens to be null, the email search is unscoped and can match members from any tenant.

### Fix

**1. `src/components/members/RegistrationQRCode.jsx`** — Always include the tenant slug in the QR URL. If `tenantSlug` is somehow null, fall back to querying the tenant's slug from `tenantId`:
```js
const registrationUrl = `${window.location.origin}/t/${tenantSlug}/register`;
```
Add early return / disabled state if `tenantSlug` is not yet resolved. Same fix for `WoFBIRegistrationQRCode.jsx`.

**2. `supabase/functions/public-register/index.ts`** — Two hardening changes:
- Before setting `user_id` on a member (line 408), verify the auth user exists via `supabase.auth.admin.getUserById(authenticatedUser.userId)`. Skip the claim if the user doesn't exist.
- When `tenantId` is null/missing for anonymous (unauthenticated) registrations, always fall back to `DEFAULT_TENANT_ID` so the email search is always tenant-scoped. (Currently it only falls back for authenticated users.)

### Files changed
- `src/components/members/RegistrationQRCode.jsx` — require tenant slug, never generate slug-less URL
- `src/components/exams/WoFBIRegistrationQRCode.jsx` — same fix
- `supabase/functions/public-register/index.ts` — verify auth user before FK write + always scope email search by tenant

