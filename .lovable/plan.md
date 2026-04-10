

## Fix: Duplicate Member Records from Profile Self-Service

### Root Cause

The duplicate for dvpwallace@yahoo.com was created through this sequence:

1. **Apr 7 22:11** — Auth user created (via signup). The `handle_new_user` trigger ran but no member record existed yet, so nothing was linked.
2. **Apr 7 22:18** — Admin created a member record manually (no `user_id` set).
3. **Apr 9 21:40** — Daphne visited MyProfile and saved. The `upsert_own_member_profile` RPC looked for a member with her `user_id` — found none (the original had no `user_id`). It **inserted a new member record**, creating the duplicate.
4. **Apr 10** — An admin manually linked the original record to her `user_id`, so now both records point to the same user.

The core issue: `upsert_own_member_profile` only checks `WHERE user_id = auth.uid()` to find an existing record. It does not fall back to checking by **email** before inserting. Additionally, there is no unique constraint on `(user_id, tenant_id)` to prevent this at the database level.

### Fix (3 parts)

#### 1. Database migration — Add unique constraint + fix RPC

```sql
-- Delete the duplicate record (the newer one with no associated data)
DELETE FROM members WHERE id = '8d9208a6-6df7-4090-8592-6bde615d56a6';

-- Add partial unique constraint: one member per user per tenant
CREATE UNIQUE INDEX idx_members_user_tenant_unique
  ON members (user_id, tenant_id)
  WHERE user_id IS NOT NULL;
```

#### 2. Update `upsert_own_member_profile` RPC

Add an email-based fallback lookup before inserting. If no member is found by `user_id`, check for an unlinked member by email in the same tenant, link it, then update — instead of creating a new record.

```text
Current logic:
  1. Look up member by user_id → found? UPDATE
  2. Not found? INSERT new record

Fixed logic:
  1. Look up member by user_id → found? UPDATE
  2. Not found? Look up unlinked member by email + tenant → found? SET user_id, then UPDATE
  3. Still not found? INSERT new record
```

#### 3. No frontend changes needed

The MyProfile page already calls the RPC correctly. The fix is entirely in the database layer.

### Files changed
- **Database migration** — delete duplicate, add unique index, update `upsert_own_member_profile` function

