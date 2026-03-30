

## Tighten Tenant Scoping on `notify-unit-leader`

### What needs fixing

The `notify-unit-leader/index.ts` edge function has two remaining tenant-scoping gaps:

1. **Line 52**: Tenant branding lookup is wrapped in `if (tenant_id)` — should always query unconditionally (same pattern as `notify-transport-booking`)
2. **Line 73-77**: `profiles` query uses `.eq("user_id", leader_user_id).single()` without `.eq("tenant_id", tenant_id)` — could return a profile from another tenant

### Changes

**Edit `supabase/functions/notify-unit-leader/index.ts`:**
- Remove `if (tenant_id)` guard around tenant branding lookup (lines 52-63) — always query `tenants` by `id = tenant_id`
- Add `.eq("tenant_id", tenant_id)` to the `profiles` query and change `.single()` to `.maybeSingle()`

No database migration needed. Redeploy the edge function after editing.

