

## Tighten Tenant Scoping on All Notification Triggers and Edge Functions

### What's already correct
- All three DB triggers pass `NEW.tenant_id` to edge functions and to notification inserts.
- The unit leader trigger scopes `unit_leader_assignments` by tenant.
- The pastoral care trigger scopes `unit_leader_assignments` by tenant.

### What needs fixing

#### 1. WSF Centre Selection Trigger — scope lookups by tenant
The `wsf_centres` and `members` lookups in `notify_wsf_leader_on_centre_selection()` don't filter by `NEW.tenant_id`. While `wsf_centre_id` is a UUID (practically unique), for strict multi-tenant isolation:

```sql
-- Line 20: add tenant filter
SELECT leader_id, name INTO _centre FROM wsf_centres
WHERE id = NEW.wsf_centre_id AND tenant_id = NEW.tenant_id;

-- Line 23: add tenant filter
SELECT user_id INTO _leader_user_id FROM members
WHERE id = _centre.leader_id AND tenant_id = NEW.tenant_id;
```

#### 2. Edge functions — always require tenant_id scoping (not conditional)
In `notify-wsf-leader`, `notify-unit-leader`, and `notify-pastoral-assignment`, member and settings queries use `if (tenant_id) query = query.eq(...)` which means if `tenant_id` is somehow null, queries are unscoped. Change to always scope:

**notify-wsf-leader/index.ts:**
- Line 71: Change `if (tenant_id) leaderQuery = leaderQuery.eq(...)` to always apply `.eq("tenant_id", tenant_id)`
- Line 159: Same for SMS settings query

**notify-unit-leader/index.ts:**
- Same pattern — always scope member + SMS settings queries by `tenant_id`

**notify-pastoral-assignment/index.ts:**
- Same pattern for member lookups and SMS settings queries

#### 3. Email/SMS log inserts — always include tenant_id
Currently uses `...(tenant_id ? { tenant_id } : {})` spread pattern. Change to always include `tenant_id` (the column is nullable, so null is fine).

### Migration
One new migration to recreate the WSF trigger function with tenant-scoped lookups.

### Edge function edits
- `supabase/functions/notify-wsf-leader/index.ts` — unconditional tenant scoping
- `supabase/functions/notify-unit-leader/index.ts` — unconditional tenant scoping
- `supabase/functions/notify-pastoral-assignment/index.ts` — unconditional tenant scoping

### Files changed
1. **New migration** — recreate `notify_wsf_leader_on_centre_selection()` with tenant-scoped lookups
2. **Edit** `notify-wsf-leader/index.ts` — always scope by tenant_id
3. **Edit** `notify-unit-leader/index.ts` — always scope by tenant_id
4. **Edit** `notify-pastoral-assignment/index.ts` — always scope by tenant_id

### Expected result
All notification triggers and edge functions enforce strict tenant isolation — no cross-tenant data leakage even if `tenant_id` is somehow null or mismatched.

