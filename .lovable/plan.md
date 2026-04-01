

## Fix: Module Toggle Not Hiding Navigation Items

### Root cause

**Data is written to one place but read from another.**

- **TenantAdmin** saves `disabled_features` into the `tenants.settings` JSON column (e.g., `tenants.settings.disabled_features = ["/transportation", "/pastoral-care"]`)
- **AppLayout** and **App.jsx** read `disabled_features` from the `app_settings` table via `useAppSetting("disabled_features", [])` — a completely separate storage location that is never written to by the toggle UI

The toggles work fine in the admin UI but have zero effect on navigation because navigation never checks `tenants.settings`.

### Fix

Update `AppLayout.jsx` and `App.jsx` to read `disabled_features` from the tenant's settings object (already available via `useTenant()` → `currentTenant.settings.disabled_features`) instead of from `app_settings`.

**1. `src/components/AppLayout.jsx`**

Replace:
```js
const { data: disabledFeatures } = useAppSetting("disabled_features", []);
```
With:
```js
const disabledFeatures = currentTenant?.settings?.disabled_features || [];
```

Remove the `useAppSetting` import if no longer used elsewhere in the file.

**2. `src/App.jsx`**

In the `TenantRoutes` component, replace the `useAppSetting` call for `disabled_features` with reading from the tenant context:
```js
const { currentTenant } = useTenant();
const disabledFeatures = currentTenant?.settings?.disabled_features || [];
```

Remove the unused `useAppSetting` import if applicable.

**3. `src/hooks/useSubFeature.js`** — Update `useTenantFeatureEnabled` to also check `disabled_features` from tenant settings:
```js
export function useTenantFeatureEnabled(routePath) {
  const { currentTenant } = useTenant();
  const disabledFeatures = currentTenant?.settings?.disabled_features || [];
  if (disabledFeatures.includes(routePath)) return false;
  // ... existing tenant feature flag checks
}
```

### Files changed
- `src/components/AppLayout.jsx` — read disabled_features from tenant settings instead of app_settings
- `src/App.jsx` — same fix in route guards
- `src/hooks/useSubFeature.js` — unify tenant feature checking

