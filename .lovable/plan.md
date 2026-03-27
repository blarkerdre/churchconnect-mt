

## Tenant-Isolate Settings Queries

### Problem

Several `app_settings` queries are missing tenant scoping on **reads**, and one upsert is missing `tenant_id`:

1. **`ExternalLinksSection.jsx`** — SELECT query has no `tenant_id` filter (line 27-37). Also missing `tenantId` in query key.
2. **`ExamManagement.jsx`** — Two `wofbi_about` SELECT queries (lines 782-788, 839-845) have no `tenant_id` filter. The upsert (line 793) is missing `tenant_id` in the payload.
3. **`ExamManagement.jsx`** — `wofbi_about` query keys don't include `tenantId`.

The `Settings.jsx` sections (`SettingsListSection`, `NotificationPreferencesSection`) are already correctly tenant-scoped on both reads and writes.

### Fix

**`src/components/settings/ExternalLinksSection.jsx`:**
- Add `tenantId` to the SELECT query: `.eq("tenant_id", tenantId)` (when set)
- Add `tenantId` to the query key: `["app-settings", "external_links", tenantId]`

**`src/pages/ExamManagement.jsx`** (two components using `wofbi_about`):
- Import and use `useTenantQuery` in both `WofbiAboutEditor` and `WofbiAboutDisplay`
- Add `.eq("tenant_id", tenantId)` to SELECT queries
- Add `tenantId` to query keys
- Use `withTenant()` on the upsert payload

### Backfill

One migration to assign orphaned `wofbi_about` rows to the correct tenant:

```sql
UPDATE app_settings
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE key = 'wofbi_about' AND tenant_id IS NULL;
```

### Files changed

- **`src/components/settings/ExternalLinksSection.jsx`** — add tenant filter to SELECT query + query key
- **`src/pages/ExamManagement.jsx`** — tenant-scope both `wofbi_about` queries + upsert
- **One data backfill migration** — fix orphaned `wofbi_about` rows

