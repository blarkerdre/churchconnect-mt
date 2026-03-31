

## Ensure All URLs Are Scoped to Tenant

### Problem

Several public routes and their backend functions operate without tenant context, causing cross-tenant data issues:

1. **Bare routes** `/register`, `/wofbi-register`, `/auth` exist without a tenant slug prefix — users landing on these get no tenant context or default to the wrong tenant
2. **`PublicWoFBIRegistration.jsx`** has zero tenant awareness — no `useParams()`, no slug, no `tenant_id` on member lookups or inserts
3. **`public-wofbi-register` edge function** creates/finds members and course registrations without any `tenant_id` scoping
4. **`exam_titles` query** on the frontend is also unscoped — shows courses from all tenants

### Fix

**1. Redirect bare public routes to default tenant** (`src/App.jsx`)
- Change `/register` → redirect to `/t/{defaultSlug}/register`
- Change `/wofbi-register` → redirect to `/t/{defaultSlug}/wofbi-register`
- Change `/auth` → redirect to `/t/{defaultSlug}/auth`
- Keep `/onboard`, `/unsubscribe`, `/presentation` as-is (they're tenant-independent utilities)

**2. Add tenant scoping to `PublicWoFBIRegistration.jsx`**
- Use `useParams()` to get `tenantSlug`
- Resolve `tenant_id` from slug via `get_tenant_by_slug` RPC (same pattern as `PublicRegistration.jsx`)
- Scope the `exam_titles` query by `tenant_id`
- Pass `tenant_id` and `tenant_slug` in the edge function request body
- Show church branding (logo, name) like `PublicRegistration` does

**3. Add tenant scoping to `public-wofbi-register` edge function**
- Accept `tenant_slug` or `tenant_id` in request body
- Resolve tenant from slug if needed, fall back to `DEFAULT_TENANT_ID`
- Scope `members` email lookup by `tenant_id`
- Include `tenant_id` on new member inserts
- Scope `exam_titles` lookup by `tenant_id`
- Include `tenant_id` on `course_registrations` insert

**4. Create a `DefaultTenantRedirect` component** (`src/App.jsx`)
- Small component that resolves the default tenant slug and redirects bare routes to their tenant-prefixed equivalents
- Prevents users from ever operating without tenant context

### Technical details

Default tenant redirect component:
```jsx
function DefaultTenantRedirect({ to }) {
  // Query default tenant slug, then Navigate to /t/{slug}/{to}
}
```

WoFBI registration tenant resolution (same pattern as PublicRegistration):
```jsx
const { tenantSlug } = useParams();
// Resolve tenant via RPC, get branding, pass tenant_id to edge function
```

Edge function tenant scoping:
```ts
const tenantSlug = body.tenant_slug;
// Resolve to tenant_id, scope all queries
.eq("tenant_id", tenantId)
```

### Files changed
- `src/App.jsx` — replace bare `/register`, `/wofbi-register`, `/auth` with default-tenant redirects
- `src/pages/PublicWoFBIRegistration.jsx` — add tenant context, branding, scoped queries
- `supabase/functions/public-wofbi-register/index.ts` — add tenant_id scoping to all DB operations

