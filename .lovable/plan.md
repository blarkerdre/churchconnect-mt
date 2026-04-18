
User is on `/index` (Landing) but the issue is about the SMS History dialog. Let me investigate what's actually happening.

Looking at `src/components/sms/SMSHistoryDialog.jsx`:
- Query: `supabase.from("sms_log").select("*").order("created_at", desc).limit(100)` with optional `.eq("sms_type", typeFilter)` and `.eq("channel", channelFilter)`.
- **It does NOT filter by `tenant_id`**. This is unusual — the project's core rule (per memory `architecture/multi-tenancy/security-guards`) is that ALL queries must include explicit `.eq("tenant_id", tenantId)` guards.

Let me check the `sms_log` table RLS — I need to verify by querying. But based on the codebase pattern and the symptom ("not showing"), the most likely causes are:

1. **Missing tenant_id filter in the React Query** — even if RLS allows reads, the query may be silently failing or returning empty due to RLS denying rows that don't match a tenant access check.
2. **RLS on `sms_log`** likely requires `user_has_tenant_access(tenant_id)` or `is_admin(...)`. If the current user isn't admin/leader OR the query doesn't hit the right rows, results = `[]`.
3. The dialog is opened from somewhere (likely Communications/SystemLogs) — need to confirm `open` is true and query is enabled.

I should investigate the actual `sms_log` RLS, recent rows, and where `SMSHistoryDialog` is rendered.

## Investigation steps (read-only)
1. `supabase--read_query` → check `sms_log` RLS policies + row count for current tenant.
2. `code--search_files` → find where `SMSHistoryDialog` is opened and confirm filters passed.
3. Check console/network for errors.

## Likely fix
Add tenant scoping to the query:
```js
const { tenantId } = useTenantQuery();
// ...
queryKey: ["sms-logs", tenantId, typeFilter, channelFilter],
queryFn: async () => {
  if (!tenantId) return [];
  let query = supabase
    .from("sms_log")
    .select("*")
    .eq("tenant_id", tenantId)
    .order("created_at", { ascending: false })
    .limit(100);
  // ...filters
}
enabled: open && !!tenantId,
```

Also surface query errors to the user (currently `error` from `useQuery` is ignored — show an inline error state so we can debug RLS denials immediately).

## Plan

### Fix
**Edit** `src/components/sms/SMSHistoryDialog.jsx`:
1. Import `useTenantQuery`, get `tenantId`.
2. Add `.eq("tenant_id", tenantId)` to the query.
3. Include `tenantId` in `queryKey`; gate `enabled: open && !!tenantId`.
4. Capture `error` from `useQuery` and render an inline error message in the list area so RLS/permission failures are visible instead of silent empty state.
5. Improve empty state copy to distinguish "no logs yet" vs "loading" vs "error".

### Verify
After the edit, open SMS History from Communications and System Logs and confirm rows render. If still empty, the RLS on `sms_log` for the calling user's role is the next layer to inspect (would require a migration to adjust policy).

### Files
- **Edit**: `src/components/sms/SMSHistoryDialog.jsx`

### Out of scope
- RLS policy changes on `sms_log` (only if the tenant-scope fix doesn't resolve it after testing).
