

## Fix: External Links Not Showing in Sidebar

### Root Cause

`ExternalLinksSection.jsx` upserts to `app_settings` without including `tenant_id` in the payload:

```js
.upsert({ key: "external_links", value: newLinks }, { onConflict: "key,tenant_id" })
```

This saves the row with `tenant_id = NULL`. The sidebar uses `useAppSetting("external_links")` which filters by `.eq("tenant_id", tenantId)`, so it never finds the NULL-tenant row.

### Fix

**`src/components/settings/ExternalLinksSection.jsx`** — import `useTenantQuery` and include `tenant_id` in the upsert payload:

```js
const { tenantId } = useTenantQuery();

// In saveMutation:
.upsert({ key: "external_links", value: newLinks, tenant_id: tenantId }, { onConflict: "key,tenant_id" })
```

**Backfill existing rows** — one migration to assign orphaned `app_settings` rows to the correct tenant (same pattern as the exam questions fix):

```sql
UPDATE app_settings
SET tenant_id = (SELECT id FROM tenants LIMIT 1)
WHERE key = 'external_links' AND tenant_id IS NULL;
```

### Files changed

- **`src/components/settings/ExternalLinksSection.jsx`** — add `tenant_id` to upsert
- **One data backfill migration** — fix existing NULL-tenant rows

