# Make switching between churches work reliably

## What the data shows

`odunsi.temitayo16@gmail.com` genuinely belongs to two churches:

- Winners Chapel International, Cardiff — role Owner (since 27 Mar)
- Demo Church (TEST) — role Member (since 11 Aug)

So "already a member of Demo Church" is correct. Both churches are active and unarchived, and the account has no two-step verification blocking access. The real problem is that the second church is hard to actually get into and impossible to stay in.

## Confirmed causes

1. **The chosen church is never remembered.** After sign-in the app always redirects to the *first* membership row returned by the database, and when no church is in the URL it falls back to a hardcoded default. Switching works for the current page view, but any sign-in, refresh or bare-URL navigation throws the user back to the other church.
2. **The switcher is only reachable in one place.** It renders only in the expanded desktop sidebar. On mobile, or with the sidebar collapsed, there is no way to switch at all.
3. **No member profile in the second church.** This person has a member record only in Cardiff. In Demo Church they have access but no directory profile, so the dashboard and member-scoped areas look empty — which reads as "the switch didn't work".
4. **Role flags leak across churches.** Owner/Admin status is currently computed from *any* membership rather than the active one, so the sidebar shows Owner-level items in a church where the person is only a Member.

## What changes

**Remember the active church**
- Persist the last selected church per signed-in user (browser storage) whenever a switch succeeds.
- On sign-in and on load without a church in the URL, prefer: URL church → last used church → default. Sign-in redirect uses the same rule instead of "first row".
- After a switch, the URL is rewritten to that church's prefix so refreshes stay put.

**Make the switcher always reachable**
- Show the church switcher when the sidebar is collapsed (compact icon-and-name menu).
- Add a "Switch church" entry to the mobile account/profile menu for accounts with more than one church.
- List churches in a stable alphabetical order.

**Handle "member of the church, but no profile yet"**
- When someone lands in a church where they have access but no member profile, show a clear inline prompt on the dashboard: "You have access to <Church> but no member profile here yet" with a "Complete my profile" action that creates their member record in that church, and a hint for admins to add them.

**Fix the role leak**
- Owner/Admin flags are derived from the membership of the *active* church only, so navigation and permissions match where the user actually is.

**Clearer invite message**
- When an invite targets someone who already belongs to that church, the message names the church and their current role, and offers "Change role" instead of a dead end.

## Technical notes

- `src/contexts/TenantContext.jsx`: add `localStorage` persistence keyed by user id; extend `selectTenant` priority to URL slug → stored id → `DEFAULT_TENANT_ID` → first. Write the stored value inside `switchTenant`.
- `src/pages/Auth.jsx` (line ~172): replace `tenantMemberships?.[0]` with the same resolution helper; extract it to a small shared module so both call sites agree.
- `src/components/AppLayout.jsx`: render the switcher in the collapsed state, sort memberships by name, keep the existing password-confirmation flow unchanged.
- `src/hooks/useAuth.jsx` (lines 273-274): scope `isTenantOwner` / `isTenantAdmin` to the active tenant id rather than `.some()` over all memberships; verify nothing depends on the old cross-church behaviour before switching it over.
- Missing-profile prompt lives in `src/components/dashboard/MemberDashboard.jsx`, gated on `tenantId && !myMember`; the insert writes an explicit `tenant_id`.
- `src/components/tenants/TenantInvitePanel.jsx`: surface the existing `already_member` response with church name and role.
- No database migration required.
