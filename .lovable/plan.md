

## Fix: Tenant Logo Not Showing on Auth Page

### Root cause

The `get_tenant_by_slug` RPC returns `logo_url` as a **top-level column**, not nested inside `settings`:

```sql
SELECT t.id, t.name, t.slug, t.logo_url, jsonb_build_object(...) AS settings
```

But `Auth.jsx` checks `tenant?.settings?.logo_url`, which doesn't exist in the returned data.

### Fix

**`src/pages/Auth.jsx`** — Change the logo check from `tenant?.settings?.logo_url` to `tenant?.logo_url`:

```jsx
{tenant?.logo_url && (
  <img src={tenant.logo_url} alt={churchName} className="h-16 w-auto mb-3 object-contain" />
)}
```

### Files changed
- `src/pages/Auth.jsx` — fix logo_url field path

