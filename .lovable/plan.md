## Goal
Add new modules to the Tenant Admin → Modules toggle list so tenants can enable/disable them alongside existing ones.

## Change
Edit `src/lib/feature-modules.js` to append five new entries to `FEATURE_MODULES`:

- `children-church` — Children Church — Secure child drop-off, pickup PIN, guardians & delegations
- `unit-tasks` — Unit Tasks — Task groups, assignments, and comments for units
- `inventory` — Inventory — Items, categories, and inspection checklists
- `reports` — Reports Hub — Cross-module reports for the Reports Officer role
- `certificates` — Certificates — Issue and approve training/course certificates

## Notes
- Keys match the existing route paths so the current `disabled_features` guard (`/${key}`) in `TenantFeaturesSection.jsx` and sidebar filtering keep working with no other changes.
- No schema, RLS, or UI-component changes. Purely a data-list update.
- Existing tenants keep their current disabled_features array; new modules default to enabled.

## Verification
Open Tenant Admin → Settings → Modules and confirm the five new rows appear with working toggles (Super Admin view — read-only badge remains for non-super admins, per current design).
