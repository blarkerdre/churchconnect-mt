

## Fix: Profile Not Updating — Missing Tenant Memberships After Signup

### Root cause

When users sign up via the auth page at `/auth` (without a tenant slug in the URL, e.g. `/t/wci-cardiff/auth`), the `tenantSlug` parameter is `undefined`. The `handle_new_user` trigger then:

1. Finds no `tenant_slug` in auth metadata
2. Finds no pending invitation for the email
3. Leaves `_tenant_id` as NULL
4. Creates a profile with `tenant_id = NULL`
5. **Skips** creating `tenant_memberships` and `user_roles` entirely

Without a `tenant_memberships` row, the user fails `user_has_tenant_access()` RLS checks and cannot read or update their own member record. The My Profile page either shows `CreateMemberProfile` (member not found) or silently fails to update.

**Confirmed**: Both `romokeseun@gmail.com` and `blarkerdre@yahoo.com` have zero `tenant_memberships` rows and zero `user_roles` rows, despite having linked member records in the default tenant.

### Fix

**1. `src/pages/Auth.jsx`** — When no tenant slug is in the URL, pass the default tenant slug so the trigger always has context:
```js
const effectiveSlug = tenantSlug || "default"; // or resolve from DEFAULT_TENANT_ID
```
- Look up the default tenant slug from `DEFAULT_TENANT_ID` and pass it to `signUp()`

**2. `handle_new_user` trigger (migration)** — Add a final fallback: if after checking slug and invitations, `_tenant_id` is still NULL, fall back to `DEFAULT_TENANT_ID`. This ensures every new user gets at least a default tenant membership:
```sql
IF _tenant_id IS NULL THEN
  _tenant_id := 'd8bbbdae-d9b3-4999-912d-3aa5999884b0'::uuid;
END IF;
```

**3. Migration — backfill missing memberships** — Fix the existing users who signed up without tenant context:
```sql
INSERT INTO tenant_memberships (user_id, tenant_id, role)
SELECT p.user_id, m.tenant_id, 'member'
FROM profiles p
JOIN members m ON m.user_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM tenant_memberships tm
  WHERE tm.user_id = p.user_id AND tm.tenant_id = m.tenant_id
)
AND m.tenant_id IS NOT NULL;

-- Same for user_roles
INSERT INTO user_roles (user_id, role, tenant_id)
SELECT p.user_id, 'member', m.tenant_id
FROM profiles p
JOIN members m ON m.user_id = p.user_id
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles ur
  WHERE ur.user_id = p.user_id AND ur.role = 'member' AND ur.tenant_id = m.tenant_id
)
AND m.tenant_id IS NOT NULL;

-- Fix null tenant_id on profiles
UPDATE profiles p
SET tenant_id = m.tenant_id
FROM members m
WHERE m.user_id = p.user_id AND p.tenant_id IS NULL AND m.tenant_id IS NOT NULL;
```

### Files changed
- `src/pages/Auth.jsx` — pass default tenant slug when no slug in URL
- 1 new migration — update `handle_new_user` with DEFAULT_TENANT_ID fallback + backfill missing memberships/roles

