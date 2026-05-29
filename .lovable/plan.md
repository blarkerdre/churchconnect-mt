# Separate Owner vs Admin permissions

Make four areas **owner-exclusive**. Tenant admins keep read access where it makes sense but lose write/destructive power.

## Scope

1. **Danger Zone** → owner only (admins don't see the tab at all)
2. **Billing / subscription** → owner only (admins don't see the tab)
3. **Promoting users to admin/owner** → owner only (admins can still invite regular members, but role selector hides `admin`/`owner` and they can't change another user's role to admin/owner)
4. **Modules (Features) page** → admins see it as **read-only** (switches disabled, no Save button); only owners can toggle and save

## Files to change

### `src/pages/Settings.jsx`
- Replace `canManageTenant = isSuperAdmin || isTenantOwner || isTenantAdmin` usage for Billing and Danger tabs with `isSuperAdmin || isTenantOwner` only.
- Hide the **Billing** tab trigger + content from non-owner admins.
- Hide the **Danger Zone** tab trigger + content from non-owner admins.
- Keep all other tabs available to admins as today.

### `src/components/settings/TenantFeaturesSection.jsx`
- Add `canEdit = isSuperAdmin || isTenantOwner`. Keep `canManage` for visibility.
- When `!canEdit`: render the list with `<Switch ... disabled />`, hide the **Save Changes** button, and show a small muted note: "Read-only — only the church owner can change modules."
- Admins still see current state but cannot toggle.

### `src/components/tenants/TenantUsersDialog.jsx`
- Gate the role selector / "Change role" action so non-owner admins cannot set a member's role to `admin` or `owner`. They can still invite/remove regular members.
- If a row's current role is `admin` or `owner`, hide the change/remove controls for non-owner admins.

### `src/components/tenants/PlatformUsersTab.jsx`
- No change — this is already Super Admin only.

## Permission matrix (after change)

```text
Capability                         Owner   Admin   SuperAdmin
─────────────────────────────────────────────────────────────
View Settings                       ✓       ✓        ✓
Branding / Comms / Units / etc.     ✓       ✓        ✓
Modules — view                      ✓       ✓        ✓
Modules — edit                      ✓       ✗        ✓
Billing tab                         ✓       ✗        ✓
Danger Zone tab                     ✓       ✗        ✓
Invite member (basic role)          ✓       ✓        ✓
Promote user to admin/owner         ✓       ✗        ✓
```

## Notes

- No DB / RLS changes — this is a UI gating pass. RLS already allows owners and admins to update tenant rows; we're tightening the client surface. If you later want server-side enforcement too, that's a follow-up migration.
- Uses existing `isTenantOwner` from `useAuth` — no new auth plumbing.
