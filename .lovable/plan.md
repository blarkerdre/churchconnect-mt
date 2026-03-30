

## Fix: Tenant Delete Not Actually Deleting (Root Cause Found)

### Root Cause
The `archive-tenant` edge function creates a single Supabase client with the service_role key (line 34). Then in the delete path, it calls `signInWithPassword()` (line 90) to verify the user's password. This **corrupts the client's auth state** — after sign-in, the client's `Authorization` header switches from the service_role key to the user's JWT. All subsequent `.delete()` calls then run as the `authenticated` Postgres role instead of `service_role`, meaning RLS policies apply. Since the user doesn't have DELETE permission on most tables, the deletes silently return 0 affected rows (not errors), and the tenant row survives.

This is why the function returns `{"success":true,"action":"deleted"}` but the tenant is still in the database.

### Fix
In `supabase/functions/archive-tenant/index.ts`:

1. **Use a separate client for password verification** — create a second Supabase client (with the anon key) solely for the `signInWithPassword` call, so the service-role client's auth state is never contaminated.

2. **Keep the service-role client untouched** for all table deletions, ensuring RLS is bypassed.

```text
// Pseudocode of the fix:
const supabase = createClient(url, serviceKey);         // service-role, for deletes
const anonClient = createClient(url, anonKey);          // anon, for password check only

// Verify password with the anon client
const { error: authError } = await anonClient.auth.signInWithPassword({ email, password });

// All deletes continue using the service-role client (unchanged)
for (const table of DELETE_TABLES) {
  await supabase.from(table).delete().eq("tenant_id", tenant_id);
}
await supabase.from("tenants").delete().eq("id", tenant_id);
```

### Files changed
- **`supabase/functions/archive-tenant/index.ts`** — create a separate anon client for password verification; keep service-role client for all data operations

### No database changes needed

### Expected result
After this fix, the delete path will actually delete all tenant data and the tenant row itself, because the service-role client (which bypasses RLS) will be used for all delete operations.

