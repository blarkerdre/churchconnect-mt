

## Fix: Profile Update Fails Due to Missing Tenant Context

### Root Cause

The user `blarkerdre@yahoo.com` (user ID `600ee600-be0f-469e-837c-6978ab850065`) signed up but was never added to a tenant:

- **No `tenant_memberships` row** — so `tenantId` resolves to `null` in the app
- **No `user_roles` row** — no role assigned
- **No `members` row** — profile page shows the "Create Profile" form
- **Profile row exists** but with `tenant_id = NULL`

When they submit the profile form, it calls the `public-register` edge function, which correctly rejects the request with *"Tenant context is required"* (line 210-215), returning a non-2xx status — hence the "Edge Function returned a non-2xx status code" error.

The user was invited to `wci-cardiff` as `owner`, but the invitation is still `pending` — auto-add didn't complete.

### Fix

#### 1. Data repair — provision tenant access (insert tool)

```sql
-- Add tenant membership
INSERT INTO public.tenant_memberships (user_id, tenant_id, role)
VALUES (
  '600ee600-be0f-469e-837c-6978ab850065',
  (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff'),
  'owner'
)
ON CONFLICT DO NOTHING;

-- Add user role
INSERT INTO public.user_roles (user_id, role, tenant_id)
VALUES (
  '600ee600-be0f-469e-837c-6978ab850065',
  'member',
  (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff')
)
ON CONFLICT (user_id, role) DO NOTHING;

-- Update profile tenant_id
UPDATE public.profiles
SET tenant_id = (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff')
WHERE user_id = '600ee600-be0f-469e-837c-6978ab850065' AND tenant_id IS NULL;

-- Mark invitation as accepted
UPDATE public.tenant_invitations
SET status = 'accepted'
WHERE email = 'blarkerdre@yahoo.com'
  AND tenant_id = (SELECT id FROM public.tenants WHERE slug = 'wci-cardiff')
  AND status = 'pending';
```

#### 2. No code changes needed

Once the tenant membership exists, `tenantId` will resolve correctly, the `public-register` function will accept the request, and the profile will be created successfully.

### Files changed

None — data-only operations via insert tool.

