

## Fix: Edge Function Error on Signup from Tenant Auth Page

### Problem

When a new user signs up via `https://app.churchmanagementsuite.org/t/wci-cardiff/auth` and lands on MyProfile, the `CreateMemberProfile` component calls `public-register` with `tenant_id` from `useTenantQuery()`. But since the user has no `tenant_memberships` row yet, `tenantId` resolves to `null`, and the edge function rejects the request with "Tenant context is required".

### Fix

Two changes are needed:

#### 1. Frontend — pass `tenantSlug` as fallback (MyProfile.jsx)

In `CreateMemberProfile`, read the tenant slug from the URL params and pass it to the edge function body so the function can resolve the tenant even when `tenantId` is null.

```js
// Add tenantSlug from URL params
const { tenantSlug: urlSlug } = useParams();

// In the invoke body, add:
tenant_slug: urlSlug || null,
```

#### 2. Edge function — resolve tenant from slug (public-register/index.ts)

After line 207 where `tenantId` is extracted, add a fallback: if `tenantId` is null but `tenant_slug` is provided, look up the tenant by slug and use that ID. This way the authenticated user's profile creation succeeds even before they have a `tenant_memberships` row.

```ts
let resolvedTenantId = tenantId;
if (!resolvedTenantId && body.tenant_slug) {
  const { data: t } = await supabase
    .from("tenants")
    .select("id")
    .eq("slug", sanitize(body.tenant_slug, 100))
    .eq("is_archived", false)
    .maybeSingle();
  if (t) resolvedTenantId = t.id;
}
```

Then use `resolvedTenantId` instead of `tenantId` in the guard check on line 210 and throughout the rest of the function.

### Files to change

- `src/pages/MyProfile.jsx` — add `useParams` import and pass `tenant_slug` in the edge function body
- `supabase/functions/public-register/index.ts` — add slug-based tenant resolution fallback

