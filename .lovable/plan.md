
## Issue
User wants to ensure ALL queries in `SignPostDialog.jsx` are explicitly scoped to the current `tenant_id`, per the multi-tenancy security guard memory (`mem://architecture/multi-tenancy/security-guards`). The previous fix only added `.eq("tenant_id", tenantId)` to the `church_units` query — other queries in the dialog (centres, leader resolution, insert payloads) need the same explicit guard.

## Investigation needed
Read the current `SignPostDialog.jsx` to enumerate every Supabase query/mutation and confirm which ones still rely on RLS-only or on `scopeQuery` without an explicit `.eq` guard.

## Plan

1. **Enumerate every DB call** in `SignPostDialog.jsx`:
   - `church_units` SELECT (already explicit ✓)
   - `wsf_centres` (Home Cell) SELECT — needs `.eq("tenant_id", tenantId)`
   - Leader resolution queries (e.g. `unit_leader_assignments`, `wsf_leader_assignments`, `user_roles`, `members`) — each needs explicit tenant guard where the column exists
   - The `signposts` / `followup_referrals` INSERT — must include `tenant_id: tenantId` in payload (use `withTenant()` helper)

2. **Apply explicit `.eq("tenant_id", tenantId)`** to every SELECT that targets a tenant-scoped table, alongside `scopeQuery` (belt-and-braces).

3. **Use `withTenant(payload)`** from `useTenantQuery` for the INSERT mutation so `tenant_id` is guaranteed in the new row.

4. **Hard-guard the submit handler**: if `!tenantId`, abort with a toast — don't write a row with NULL tenant.

5. **Update query keys** to include `tenantId` so cache doesn't bleed across tenant switches (already done for units; verify centres + leaders).

## Files
- **Inspect**: `src/components/followups/SignPostDialog.jsx` (full file) to enumerate all DB calls.
- **Edit**: `src/components/followups/SignPostDialog.jsx` — add explicit tenant guards on every query and the insert payload, plus a submit-time `tenantId` guard.

After approval I'll read the current file end-to-end, then apply all guards in one pass.
