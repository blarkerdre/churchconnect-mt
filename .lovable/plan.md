## Goal
Tenant owners (and tenant admins) should be able to see and manage every tab in their tenant's Settings page — including the ones currently restricted to Super Admin — plus a new **Features** tab that lets them enable/disable modules for their own tenant.

## Current behavior
In `src/pages/Settings.jsx`, three tabs are gated behind `isSuperAdmin` (`roles.includes("super_admin")`):
- **Certs** (`CertificateTemplateSettings`)
- **Links** (`ExternalLinksSection`)
- **Danger** (`DangerZoneSection`)

Tenant owners/admins cannot see them, even though these affect only their own tenant's data.

There is also no in-tenant UI to toggle modules — module on/off (`tenants.settings.disabled_features`) is only editable by Super Admins from `TenantAdmin.jsx` → Features tab.

## Changes

### 1. `src/pages/Settings.jsx`
- Pull `isTenantOwner`, `isTenantAdmin` from `useAuth()` alongside `roles`.
- Define `canManageTenant = isSuperAdmin || isTenantOwner || isTenantAdmin`.
- Replace the three `isSuperAdmin` gates around **Certs**, **Links**, and **Danger** (both `TabsTrigger` and `TabsContent`) with `canManageTenant`.
- Add a new **Features** tab (icon: `SlidersHorizontal` or `ToggleLeft` from lucide-react) gated by `canManageTenant`, placed before **Consent**.

### 2. New `src/components/settings/TenantFeaturesSection.jsx`
A self-contained section that lets a tenant owner toggle their own tenant's modules:
- Read `currentTenant` from `useTenant()`; load `settings.disabled_features` (array of route paths).
- Render the same `FEATURE_MODULES` list used by `TenantAdmin.jsx` (extract the constant into `src/lib/feature-modules.js` and import it from both places to avoid duplication).
- Each row: label, description, `<Switch>` checked when NOT in `disabled_features`.
- Save via `supabase.from("tenants").update({ settings: { ...currentTenant.settings, disabled_features } }).eq("id", tenantId)`, then `queryClient.invalidateQueries` for the tenant query so navigation refreshes.
- Show toast on save; disable controls while saving.
- Guard: render an "access denied" message if neither owner/admin nor super_admin.

### 3. `src/lib/feature-modules.js` (new)
Export `FEATURE_MODULES` (moved from inside `TenantAdmin.jsx`) so both the super-admin tenant editor and the new tenant-side Features section share one source of truth.

## Out of scope
- Sub-feature toggles (`disabled_sub_features` in `app_settings`) remain managed where they are today; this change only exposes module-level toggles to tenant owners.
- No DB / RLS changes needed: `tenants` updates are already permitted for tenant owners/admins by existing policies used elsewhere in the app.
- Danger Zone internals are not modified — only its visibility gate.
