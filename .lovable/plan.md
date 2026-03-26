

## Fix: Cross-Tenant Member Linking Vulnerability

### Problem

Both `auto_link_member_by_email` and `claim_own_member_profile` RPCs search the `members` table by email without filtering by `tenant_id`. A user from Tenant A could be linked to a member record in Tenant B.

### Solution

**1. Update `auto_link_member_by_email`** — add `_tenant_id uuid DEFAULT NULL` parameter and filter with `AND (_tenant_id IS NULL OR tenant_id = _tenant_id)`.

**2. Update `claim_own_member_profile`** — scope member lookup to tenants the calling user belongs to via `tenant_memberships`.

**3. Update `admin-create-user` edge function** — pass `tenant_id` to `auto_link_member_by_email` call.

**4. Update `useAuth.jsx`** — the `claim_own_member_profile` fix is self-contained in the RPC (uses `auth.uid()` to resolve tenant memberships), so no caller changes needed.

### Technical Details

**Migration SQL:**
```sql
-- 1. Replace auto_link_member_by_email with tenant-scoped version
CREATE OR REPLACE FUNCTION public.auto_link_member_by_email(
  _user_id uuid, _email text, _tenant_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE _member_id uuid; _match_count integer;
BEGIN
  IF _user_id IS NULL OR _email IS NULL THEN RETURN NULL; END IF;

  SELECT id INTO _member_id FROM public.members
  WHERE user_id = _user_id
    AND (_tenant_id IS NULL OR tenant_id = _tenant_id)
  LIMIT 1;
  IF _member_id IS NOT NULL THEN RETURN _member_id; END IF;

  SELECT count(*), min(id) INTO _match_count, _member_id
  FROM public.members
  WHERE lower(email) = lower(_email)
    AND user_id IS NULL
    AND (_tenant_id IS NULL OR tenant_id = _tenant_id);

  IF _match_count = 1 AND _member_id IS NOT NULL THEN
    UPDATE public.members SET user_id = _user_id, updated_at = now()
    WHERE id = _member_id AND user_id IS NULL;
    RETURN _member_id;
  END IF;
  RETURN NULL;
END;
$$;

-- 2. Replace claim_own_member_profile with tenant-scoped version
CREATE OR REPLACE FUNCTION public.claim_own_member_profile()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _user_id uuid := auth.uid();
  _email text := lower(nullif(auth.jwt() ->> 'email', ''));
  _member_id uuid;
  _match_count integer;
BEGIN
  IF _user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

  -- Already linked?
  SELECT id INTO _member_id FROM public.members
  WHERE user_id = _user_id ORDER BY created_at DESC LIMIT 1;
  IF _member_id IS NOT NULL THEN RETURN _member_id; END IF;

  IF _email IS NULL THEN RETURN NULL; END IF;

  -- Only match members in tenants the user belongs to
  SELECT count(*) INTO _match_count
  FROM public.members m
  WHERE lower(m.email) = _email AND m.user_id IS NULL
    AND m.tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = _user_id);

  IF _match_count > 1 THEN
    RAISE EXCEPTION 'Multiple member records match this email. Please contact an administrator.';
  END IF;

  IF _match_count = 1 THEN
    SELECT m.id INTO _member_id FROM public.members m
    WHERE lower(m.email) = _email AND m.user_id IS NULL
      AND m.tenant_id IN (SELECT tenant_id FROM public.tenant_memberships WHERE user_id = _user_id)
    LIMIT 1;

    UPDATE public.members SET user_id = _user_id, updated_at = now()
    WHERE id = _member_id AND user_id IS NULL;
    RETURN _member_id;
  END IF;

  RETURN NULL;
END;
$$;
```

**`admin-create-user/index.ts`** (~line 127): Change `auto_link_member_by_email` call to pass `tenant_id`:
```typescript
const { data: linkedMemberId } = await supabase.rpc("auto_link_member_by_email", {
  _user_id: userId,
  _email: normalizedEmail,
  _tenant_id: tenant_id || null,
});
```

### Files Changed

- **One database migration** — replace both RPCs with tenant-scoped versions
- **`supabase/functions/admin-create-user/index.ts`** — pass `tenant_id` to RPC call

