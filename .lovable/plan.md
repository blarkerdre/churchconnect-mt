

## Fix: Users Not Appearing in User Management

### Root Cause

Two issues found:

1. **The `handle_new_user` trigger on `auth.users` is missing.** This trigger is supposed to automatically create a `profiles` row when a new auth user is created. Without it, neither self-signup nor `admin-create-user` (via `auth.admin.createUser`) generates profile rows via the trigger path.

2. **The `profiles` table has 0 rows** despite 3 `auth.users` existing and 4 `tenant_memberships`. The User Management page queries `profiles` with `scopeQuery` — no profiles means no users displayed.

The `admin-create-user` edge function does manually upsert into profiles, but without the trigger, users created through normal signup (or the auth email flow) get no profile row at all.

### Fix

#### 1. Database migration — recreate trigger + backfill profiles

```sql
-- Recreate the trigger
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for existing auth users
INSERT INTO public.profiles (user_id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Set tenant_id on backfilled profiles from tenant_memberships
UPDATE public.profiles p
SET tenant_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm
  WHERE tm.user_id = p.user_id LIMIT 1
)
WHERE p.tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = p.user_id);
```

#### 2. No code changes needed
- `admin-create-user` already upserts profiles with `tenant_id` — that's fine as a belt-and-suspenders approach
- User Management page already queries profiles with `scopeQuery` — once profiles exist with correct `tenant_id`, users will appear

### Files changed
- **One database migration** — recreate trigger + backfill profiles

