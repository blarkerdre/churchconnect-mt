# Allow unit_leader / wsf_leader direct member assignment

## Problem

When Favour (a `unit_leader`, not admin) edits a member and changes their **Church Unit** or **Home Cell Centre**, the change does not stick. The form silently converts her additions into **pending join requests** that an admin must approve, because of the gate in `MemberFormDialog.jsx`:

```js
const requiresApproval = !isAdmin || isSelfEdit;
```

Any non-admin (including unit/home‑cell leaders) hits the approval path.

## Goal

Unit leaders and Home Cell (WSF) leaders should be able to directly assign members to **units and centres they themselves lead**, without admin approval. All other cases keep the current approval flow.

## Changes

### 1. `src/components/members/MemberFormDialog.jsx`

- Pull current user's leader scope:
  - Units led: from `unit_leader_assignments` for `auth.uid()` in current tenant (already queried via `useUnitMembership` / similar; otherwise add a small `useQuery`).
  - Centres led: from `wsf_centres` where `leader_id = currentMember.id` in current tenant.
- Compute the diff (existing logic via `diffUnitMembership`).
- Split additions into two buckets:
  - **Auto‑approved** additions → unit names the editor leads, plus centre id the editor leads. Apply directly to `payload.church_unit` / `payload.wsf_centre_id`.
  - **Needs approval** additions → everything else, queued via `submitJoinRequests` as today.
- Removals: keep applying immediately (unchanged).
- Self‑edit case (`isSelfEdit`) keeps requiring approval (unchanged).
- Toast wording: if some adds applied and some queued, show a combined message ("Assigned X, Y pending approval").

### 2. RLS sanity check (no migration unless needed)

`members` UPDATE policy must allow a `unit_leader` / `wsf_leader` in the same tenant to update unit/centre fields. If it currently restricts to admins, add a tenant‑scoped policy:

```sql
-- only if missing
CREATE POLICY "Leaders can update members in their tenant"
ON public.members FOR UPDATE
USING (public.user_has_tenant_access(auth.uid(), tenant_id)
       AND (public.has_role(auth.uid(), 'unit_leader')
            OR public.has_role(auth.uid(), 'wsf_leader')))
WITH CHECK (public.user_has_tenant_access(auth.uid(), tenant_id));
```

I'll verify the existing policy first and only add this if the update is being blocked at the DB layer.

### 3. No changes to

- `unit_join_requests` table or RPCs.
- `BulkUnitAssignDialog` / `UnitLeaderAssignments` (those are admin‑only screens for assigning *leader roles*, separate concern).
- Self‑edit approval flow.

## Out of scope

- Granting Favour full `tenant_admin` (rejected option).
- Changing the Pending Join Requests UI.

## Verification

1. As Favour (`unit_leader` of a unit she leads): edit a member, add that unit → saves directly, member shows the unit immediately.
2. As Favour: edit a member, add a unit she does **not** lead → still creates pending join request.
3. As Favour (also `wsf_leader` of Centre X): set member's Home Cell Centre to X → saves directly.
4. As an admin: behaviour unchanged (direct assignment for anything).
5. Self‑edit: still queues a request even if the user is a leader.
