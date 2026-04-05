

## Remove Default Tenant Fallback on Signup

### Problem
When a user signs up without a tenant slug (e.g. via `/auth` instead of `/t/my-church/auth`), the database trigger `handle_new_user` silently assigns them to the Demo Church. This causes confusion when users end up in the wrong church.

### Solution
Two changes:
1. **Database trigger** — Instead of falling back to the Demo Church ID, raise an exception when no tenant can be resolved (no slug, no invitation). This prevents the user account from being created without a valid tenant.
2. **Client-side Auth page** — When no tenant slug is in the URL, hide the signup option and show a message directing users to contact their church admin for the correct signup link. Login remains available (existing users already have a tenant).

### Changes

#### 1. Database migration — Update `handle_new_user()` function
Replace the fallback line:
```sql
IF _tenant_id IS NULL THEN
  _tenant_id := 'd8bbbdae-...'::uuid;
END IF;
```
With:
```sql
IF _tenant_id IS NULL THEN
  RAISE EXCEPTION 'No tenant could be resolved for this signup. Please use your church-specific registration link.';
END IF;
```
This causes `supabase.auth.signUp()` to return an error, which the UI already handles via toast.

#### 2. `src/pages/Auth.jsx` — Block signup when no tenant slug
- Remove the `defaultTenantSlug` query (no longer needed as fallback)
- When `tenantSlug` is absent from the URL, disable the "Sign up" option — hide the "Don't have an account? Sign up" link and the signup mode entirely
- Show a small info banner: "To create an account, please use the signup link provided by your church."
- Login and forgot-password remain available for all users regardless of slug presence

### Files changed
- Database migration — update `handle_new_user()` to raise exception instead of defaulting
- `src/pages/Auth.jsx` — hide signup when no tenant slug, remove default tenant slug query

