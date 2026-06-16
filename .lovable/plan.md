## Goal
Remove the Email tab/view from the Communications page for regular members. Admins and users with `canManageComms` keep full access.

## Changes — `src/pages/Communications.jsx`

1. **Tab trigger (line 598)** — change condition from `emailEnabled` to `emailEnabled && canManageComms` so members no longer see the Email tab.
2. **Tab content (line 669)** — same gate: `emailEnabled && canManageComms`. Removes the `MemberEmailList` branch entirely for members.
3. **Default tab (line 585)** — update the `defaultValue` fallback so it doesn't default to `"email"` for members: use `emailEnabled && canManageComms` in the chain.
4. **Email count query (line 413)** — restrict `enabled` to `emailEnabled && canManageComms && !!tenantId`, dropping the member-email branch (no longer needed).
5. Remove now-unused `MemberEmailList` component, `selectedEmailLog` state, and the Email Detail Dialog (lines 235–268, 295, 837–end of that dialog) since they only served the member view.

## Out of scope
- SMS, WhatsApp, and Announcements tabs are unchanged.
- No DB/RLS changes — admins continue to use existing `EmailAlertForm` flow.
