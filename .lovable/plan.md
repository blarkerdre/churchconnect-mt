
## Issue
User opened SignPost dialog → "Unit Leader" tab shows nothing, no toast. Session replay shows the unit dropdown opened with "8 units available" once, but on a different tenant/page it's empty with no feedback.

## Investigation

Let me check the actual data state and RLS for `church_units` against the current tenant.
<br>

Checking:
1. Whether `church_units` rows exist for the current tenant
2. Whether `scopeQuery` correctly applies `tenant_id`
3. Whether the query actually errors silently
<br>

I need to inspect:
- `useTenantQuery.scopeQuery` — does it inject `tenant_id` filter?
- The active tenant on `/index` route — replay shows user is on Dashboard, but route is `/index`. The dialog is opened from Dashboard's `SignPostedToMeWidget` or similar.
- Whether `tenantId` is resolved before the dialog opens (if `tenantId` is undefined, `enabled: open && !!tenantId` blocks the query and shows nothing — no error, no toast).
<br>

## Likely root cause
The query is `enabled: open && !!tenantId`. If the user opens the dialog from a context where `tenantId` is briefly null (e.g. on `/index` dashboard before tenant resolves, or from a notification deep-link), the query never fires. UI shows the empty Select with no loading/error state because `unitsLoading=false` and `unitsError=null` — `units=[]` (default).

Also, the previous fix added a "no units configured" warning, but that warning only shows when `!unitsLoading && units.length === 0`. If `tenantId` is null, the query is disabled, `unitsLoading` stays `false`, and we silently render the same warning — but the user reports no warning either, which means the **dialog body itself isn't rendering the unit_leader branch** OR the previous fix wasn't picked up.

I'll re-check the file as it stands now and the path that opens the dialog.

## Plan

1. **Confirm `tenantId` resolution**: add a defensive branch in `SignPostDialog.jsx` — if `!tenantId`, show a clear "Loading tenant context…" state instead of an empty Select, and prevent submission.

2. **Surface query errors loudly**: in addition to the inline alert, fire a `toast.error` once per error so the user sees feedback even if the alert is off-screen on small viewports (user is on 384px width).

3. **Verify `scopeQuery` behaviour**: read `useTenantQuery.jsx` to confirm it injects `tenant_id`. If it does not auto-inject for `church_units` (e.g. relies on RLS only), add an explicit `.eq("tenant_id", tenantId)` for safety per the multi-tenancy guards memory.

4. **Add a console log** when units load with `0` length and `tenantId` is set, so we can confirm the RLS path in the user's session.

5. **Re-render fallback**: when the dialog opens with `defaultType="unit_leader"` but no units exist AND no centres exist either, auto-toast "No leaders configured for sign-posting yet."

## Files to edit
- `src/components/followups/SignPostDialog.jsx` — add tenant-context guard, explicit `.eq("tenant_id", tenantId)`, error toast on query failure, and a one-shot toast when units list resolves empty.

## Files to inspect (read-only, no changes)
- `src/hooks/useTenantQuery.jsx` — confirm `scopeQuery` injects `tenant_id` filter.
- The component that opens `SignPostDialog` from the dashboard widget — confirm it passes a valid `followup` and is gated on `tenantId`.

After approval I'll inspect `useTenantQuery.jsx` first, then apply the SignPostDialog edits in one pass.
