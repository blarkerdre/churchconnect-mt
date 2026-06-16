## Goal
Surface Inventory's per-tenant settings inside the main Settings page so admins can configure them from one place.

## What moves
Today the only inventory setting is **Church Office unit** (the unit whose members can manage inventory / run inspections), stored at `app_settings.key = 'inventory.church_office_unit'`. It lives behind a gear icon on the Inventory page (`SettingsDialog` in `src/pages/Inventory.jsx`).

## Changes

1. **New section component** `src/components/settings/InventorySettingsSection.jsx`:
   - Tenant-scoped read of `app_settings` row (`key=inventory.church_office_unit`, `.eq("tenant_id", tenantId)`).
   - Select populated from `church_units` (active, tenant-scoped) — same source as today.
   - Save via `upsert(withTenant({...}), { onConflict: "key,tenant_id" })`.
   - Visible to admins/owners only (use `canManageTenant` pattern like other admin sections).
   - Uses Source Sans 3 / Playfair design tokens, no hardcoded colors.

2. **Add tab in `src/pages/Settings.jsx`**:
   - New `inventory` tab with `Package` icon, gated on `canManageTenant`.
   - Tab trigger placed near `services`/`events`.
   - `<TabsContent value="inventory">` renders the new section.

3. **Inventory page (`src/pages/Inventory.jsx`)**:
   - Replace the gear-icon `SettingsDialog` with a link/button "Open in Settings" that navigates to `/t/:tenantSlug/settings?tab=inventory` (preserving deep-link behaviour already used by other tabs if present, else just sets the active tab via existing query-param mechanism if there is one; otherwise just navigates to `/settings`).
   - Remove the now-unused `SettingsDialog` component from `Inventory.jsx`.

## Out of scope
- No DB changes (key already tenant-scoped).
- No RLS changes.
- No new settings keys (still just `inventory.church_office_unit`).
- No visual redesign of the Settings page.

## Verification
- Switch tenants and confirm each tenant shows/saves its own Church Office unit in Settings → Inventory.
- Inventory page still reads the same setting and behaves identically.
- Non-admins don't see the Inventory tab.
