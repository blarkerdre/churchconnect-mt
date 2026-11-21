# Church data separation audit and fix

## What the audit found
- **Saved records are fine.** Every member belongs to exactly one church. Cardiff has 356, Croydon 4, Demo 7, RCCG 1. No Cardiff record is linked to someone from another church.
- **Screens:** I checked all 132 screens and helpers that load church data, plus every direct data request. Nearly all of them limit results to the church you are viewing.
- **The gap (confirmed in code):** the shared "only this church" filter does nothing while the app doesn't yet know which church you are in. That happens for a moment on page load and after switching church. It also happens if you view a church you aren't listed under, which can happen as a Super Admin. In those moments the filter is skipped, and a Super Admin is allowed to see every church, so the Members list (which refreshes every 5 seconds) and other lists can show members from all churches.
- **Where this shows (inferred from code):** for Super Admins looking at Cardiff, other churches' members appear in Members, message audiences and reports. Ordinary Cardiff admins are still stopped by the database's own church rules.

## Fix
1. **Fail closed:** when no church is selected, the shared filter returns nothing instead of everything. One change covers every screen that uses it.
2. **Wait for the church:** list screens (Members, Communications audiences, reports, logs, attendance, Bible School, Home Cell) only load once the church is known.
3. **Check the leftovers by hand:** a few screens build their filter themselves with "only if a church is set". Change these to always require the church: My Profile, Self check-in, Exam Management, Sermon Notes, Communications, Training Reports, System Logs, Email dashboard, Domifort, agreement templates.
4. **Database pass:** list every table rule and shared lookup that lets Super Admins see all churches. Make sure nothing else gives church admins or officers rows from another church, and record any gaps found.
5. **Test:** one automated check that the shared filter returns no rows when no church is selected. Then open Cardiff as a Super Admin and confirm the Members list shows only 356 Cardiff members.

## Technical details
- src/hooks/useTenantQuery (scopeQuery): when tenantId is null, apply `.eq("tenant_id", "00000000-0000-0000-0000-000000000000")` rather than returning the query unchanged.
- Add `&& !!tenantId` to `enabled` on tenant-scoped useQuery calls (Members.jsx line ~127 first).
- Replace `if (tenantId) query = query.eq(...)` patterns with an unconditional tenant guard.
- Read pg_policies for super_admin bypasses and the RPCs that take `_tenant_id`. Report only; RLS changes go in a separate migration if a real gap appears.
