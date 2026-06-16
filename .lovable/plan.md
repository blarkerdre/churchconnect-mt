## Changes to `src/pages/Inventory.jsx`

1. **Remove the Settings dialog feature**
   - Delete the Settings button in the header (currently shown to admins).
   - Delete the `useQuery` that reads `inventory.church_office_unit` from `app_settings`.
   - Delete the `SettingsDialog` component and its mount.
   - Remove `SettingsIcon` import and `settingsOpen` state.

2. **Hardcode the gating unit to "Church Office Unit"**
   - Use `useUnitMembership("Church Office Unit")` directly.

3. **Restrict access to Church Office Unit members only**
   - Change `canManage` from `isAdmin || isSuperAdmin || isOfficeMember` to **`isOfficeMember`** only.
   - Tenant admins / super admins will no longer get automatic access — they must be assigned to the Church Office Unit.
   - Unauthorised users continue to be redirected to the tenant home via `<Navigate>`.

4. **Sidebar/nav visibility (if applicable)**
   - Check `src/components/AppLayout.jsx` for the Inventory nav entry and gate it on the same `useUnitMembership("Church Office Unit")` check so non-members don't see the link.

## Notes
- No DB/RLS changes. Existing RLS on `inventory_*` tables already restricts by `tenant_id`; client-side gating is the unit-membership check.
- The orphaned `app_settings` row with key `inventory.church_office_unit` (if any) is left in place — harmless.
- Confirming the exact unit name as **"Church Office Unit"** (matches your message). If your tenant's unit is actually named "Church Office", say so and I'll use that string instead.
