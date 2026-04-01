

## Show Tenant Logo on Auth Page

### What's wrong

The auth page (line 173-174) only shows the tenant name as text. It doesn't display the tenant's logo even though `tenant.settings.logo_url` is available from the `get_tenant_by_slug` RPC.

### Fix

**`src/pages/Auth.jsx`** — Add the tenant logo above the church name:

```jsx
<div className="flex flex-col items-center mb-8">
  {tenant?.settings?.logo_url && (
    <img
      src={tenant.settings.logo_url}
      alt={churchName}
      className="h-16 w-auto mb-3 object-contain"
    />
  )}
  <h1 className="font-display text-2xl font-bold text-foreground">{churchName}</h1>
</div>
```

When no tenant is loaded (generic `/auth`), no logo shows and "Church Connect" displays as before. When a tenant slug is present and the tenant has a logo configured, it renders above the name.

### Files changed
- `src/pages/Auth.jsx` — add tenant logo image above church name

