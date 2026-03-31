

## Fix: Auto-Link Member to Auth User on Registration & Signup

### Root cause

When a user registers via QR code (`public-register`), the flow is:
1. Edge function creates a **member record** (no `user_id` — user hasn't signed up yet)
2. User later signs up via the auth page
3. `handle_new_user` trigger creates profile + tenant membership
4. **Nothing links the member record to the new auth user**

The `auto_link_member_by_email` RPC exists and is used in `admin-create-user`, but it's never called during the normal signup flow.

### Fix

**1. `handle_new_user()` database trigger** — After creating the profile and tenant membership, call `auto_link_member_by_email` to link any unlinked member record matching the user's email and tenant:

```sql
-- After the existing INSERT INTO profiles / tenant_memberships block:
UPDATE public.members
SET user_id = NEW.id
WHERE lower(email) = lower(NEW.email)
  AND tenant_id = _tenant_id
  AND user_id IS NULL
LIMIT 1;
```

This is the most robust fix because it runs atomically during signup, regardless of how the user was created (QR registration, direct signup, invitation).

**2. Backfill migration** — Fix existing unlinked members where a profile exists with the same email and tenant:

```sql
UPDATE members m
SET user_id = p.user_id
FROM profiles p
WHERE lower(m.email) = lower(p.email)
  AND m.tenant_id = p.tenant_id
  AND m.user_id IS NULL
  AND p.user_id IS NOT NULL;
```

### Files changed
- 1 new migration — enhance `handle_new_user()` to auto-link members + backfill existing unlinked records

