## Why Ejiama and Silver showed up in Demo Church

Both members exist twice in the database — once in **Demo Church (TEST)** with no `user_id`, and once in **Winners Chapel International, Cardiff** a few minutes later with a real `user_id`. The wci-cardiff rows are their real signups.

Root cause: the public registration flow silently defaults to demo-test whenever it can't resolve a tenant.

- **Backend** (`supabase/functions/public-register/index.ts`, line ~304): hardcoded `DEFAULT_TENANT_ID = "d8bbbdae…884b0"` (demo-test). Any submission without `tenant_id` or `tenant_slug` is dropped into demo-test.
- **Frontend** (`src/pages/PublicRegistration.jsx`, lines 53 & 143): mirrors the same `DEFAULT_TENANT_ID` constant and explicitly sends `tenant_id: resolvedTenantId || DEFAULT_TENANT_ID`.

So whoever shared a registration link with these two used a URL where the tenant slug wasn't in the path — the form went through, defaulted to demo-test, and created the orphan records you're seeing now. They later registered properly under wci-cardiff. This also contradicts the project's own Signup Restriction rule (block signups lacking valid tenant resolution).

## Fix

### 1. Clean up the orphan rows

Delete the two unlinked demo-test member records:

- `id = d458dec2-fed4-4517-a4b9-5e498438de7c` (Ejiama, demo-test, no user_id)
- `id = 2074b780-2fdc-4a2b-b6de-e38b308f3d5f` (Silver, demo-test, no user_id)

The wci-cardiff records stay untouched.

### 2. Remove the demo-test default from public registration

**Backend** (`supabase/functions/public-register/index.ts`):
- Remove the `DEFAULT_TENANT_ID` constant and the "always fall back" block.
- If neither `tenant_id` nor a valid `tenant_slug` resolves, return **400 Bad Request** with `{ error: "Missing tenant context" }` instead of silently writing to demo-test.

**Frontend** (`src/pages/PublicRegistration.jsx`):
- Remove the `DEFAULT_TENANT_ID` constant and the `|| DEFAULT_TENANT_ID` fallbacks (lines 53 & 143).
- If `tenantSlug` is missing **and** `resolvedTenantId` cannot be resolved, render an inline error ("This registration link is invalid — please ask your church for the correct link") and disable submit. Already-correct paths like `/t/:tenantSlug/register` are unaffected.

No other files need changes — `/register` (no slug) is already routed through `DefaultTenantRedirect` in `App.jsx`, which sends users to a tenant-prefixed URL when a default exists.

## Validation

- After cleanup, `/t/demo-test` member list no longer shows Ejiama or Silver.
- Submitting the registration form on a URL without tenant context returns a clear error instead of polluting demo-test.
- wci-cardiff member counts and dashboard stats are unchanged.
