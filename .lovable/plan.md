## Goal
In Children Church, any member of the Children Church unit can use all features (Check-in, Pickup, All children). Only the Children Church unit leader (or tenant admin) can see the Report tab.

## Change (single file: `src/pages/ChildrenChurch.jsx`)

1. Add a membership query alongside the existing leader query:
   - Call `supabase.rpc("is_children_church_member", { _user_id, _tenant_id })` → `isUnitMember`.
   - Fallback: if that RPC doesn't exist, derive membership via `church_units` (slug/code `children_church`) joined to the user's member record. We'll attempt the RPC first; if it returns an error we'll do the table-based lookup. (Code-only fallback, no DB changes.)
   - Treat `isLeader || isAdmin` as also satisfying `isUnitMember`.

2. Update the tabs in the `ChildrenChurch` component (lines 1201–1212):
   - `Check-in` and `Pickup`: visible to everyone who can reach the page (unchanged).
   - `All children` tab: show when `isUnitMember || isLeader || isAdmin` (was leader/admin only).
   - `Report` tab: keep restricted to `isLeader || isAdmin` (unchanged).
   - `TabsList` grid columns adjust based on how many tabs render (3 vs 4).

3. `PickupPanel` keeps receiving `isLeader={isLeader || isAdmin}` so the "Leader override" action stays gated to leaders only — only the Report tab visibility changes for unit members vs leaders.

## Out of scope
- No DB / RLS / migration changes. Existing RLS already allows unit members to read children/check-in rows; we are only adjusting the UI tab gating.
- No changes to route-level access control (`AppLayout`/sidebar). If you also want the nav entry shown to plain unit members, say so and I'll extend the plan.
