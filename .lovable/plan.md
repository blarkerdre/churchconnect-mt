# Auto-seed default option lists in Settings

## Problem
The Settings tabs **Services**, **Events**, **Training**, and **Pastoral** show "No items configured" because no `app_settings` row exists for these keys for the tenant. Forms across the app fall back to hardcoded `DEFAULT_*` lists, but the Settings UI doesn't surface those defaults.

## Fix
When a tenant admin opens one of these tabs and the `app_settings` row is missing, automatically write the in-code defaults to `app_settings` for that tenant. The list then renders the standard options and admins can add/edit/remove from there.

## Changes

**File:** `src/pages/Settings.jsx` (only)

1. Extend `SettingsListSection` to accept an optional `defaults` prop (string array).
2. After the `useQuery` resolves, if the row didn't exist (we'll detect via a `rowExists` flag returned from the query) and `defaults` is non-empty, trigger a one-time upsert of `{ key, tenant_id, value: defaults }`. Guard with a `useRef` so it fires once per mount/tenant.
3. Pass the appropriate defaults to each of the four `<SettingsListSection>` instances, sourced from the same constants the forms already use:
   - `service_types` → existing default service list (mirrors `ChurchAttendance.jsx` defaults)
   - `event_categories` → categories from `EventFormDialog.jsx` / `EventCard.jsx`
   - `training_types` → BFC/BCC/LCC/LDC + existing training defaults
   - `pastoral_care_types` → `DEFAULT_CATEGORIES` from `PastoralCareFormDialog.jsx`

Defaults will be declared as `const` arrays at the top of `Settings.jsx` to keep this self-contained.

## Behavior
- First admin to open the tab seeds the list; subsequent visits read the saved row.
- Admins can edit or delete any item afterwards (including down to an empty list — we won't re-seed once a row exists, even if emptied).
- No schema changes, no edge function, no migration.
- Scoped per tenant via the existing `withTenant` / `tenant_id` guards.

## Out of scope
- Backfilling other tenants in bulk.
- Changing the form fallbacks (they remain as safety nets).
- Any UI restyle of the tabs themselves.
