

## Fix: Public Registration Fails Without Tenant Context on `/register`

### Root cause
The `/register` route has no `:tenantSlug` parameter, so `useParams()` returns no slug. The component never resolves a `tenant_id`, and the `public-register` edge function receives no tenant context — causing the registration to fail or create orphaned records.

### Fix

**1. `src/pages/PublicRegistration.jsx`** — Add fallback tenant resolution
- When no `tenantSlug` is available from the URL, resolve the tenant using a fallback:
  - Check if there's a `tenant` query parameter in the URL (e.g., `/register?tenant=my-church`)
  - If still no slug, use the default tenant ID as a last resort
- Show a clear error message if no tenant can be resolved, with guidance to use the church-specific registration link

**2. `src/App.jsx`** — Redirect bare `/register` to tenant-prefixed route
- Option A: Remove the bare `/register` route entirely and only keep `/t/:tenantSlug/register`
- Option B: Keep `/register` but add query-param support (`/register?slug=my-church`)

**Recommended approach**: Keep both routes but make the bare `/register` resolve the default tenant automatically (since this is a single-org deployment scenario), while the tenant-prefixed route works as-is.

### Changes
- `src/pages/PublicRegistration.jsx` — when `tenantSlug` is absent, fall back to the default tenant ID (`d8bbbdae-d9b3-4999-912d-3aa5999884b0`) so registration always has tenant context
- Also pass `tenant_slug` in the edge function body when `tenantSlug` is available (as a secondary fallback for the edge function)

### Files changed
- `src/pages/PublicRegistration.jsx` — add default tenant fallback + pass `tenant_slug` to edge function

