

## Route All Prayer Requests to Pastoral Care Unit Leaders + Allow Reassignment to Unit Members

### Current State
1. **Public registration** (`public-register` edge function): Prayer requests auto-assign to Pastoral Care unit leaders via least-busy round-robin — but only queries `unit_leader_assignments`, not tenant-scoped
2. **Member dashboard** (`PastoralCareRequestDialog`): Inserts directly with NO auto-assignment
3. **Pastoral Care page** (`PastoralCare.jsx`): "Assign To" dropdown only shows unit leaders from `unit_leader_assignments`, not regular unit members

### Changes

#### 1. `PastoralCareRequestDialog.jsx` — Add auto-assignment to unit leader
Before inserting, query `unit_leader_assignments` for Pastoral Care leaders (tenant-scoped), pick the least-busy one, and set `assigned_to`. This mirrors the public-register logic.

#### 2. `supabase/functions/public-register/index.ts` — Add tenant scoping
The `createPastoralCareForPrayerRequest` function currently queries `unit_leader_assignments` without tenant filtering. Add `.eq("tenant_id", tenantId)` to scope correctly, and pass `tenant_id` into the inserted `pastoral_care` row.

#### 3. `src/pages/PastoralCare.jsx` — Expand "Assign To" dropdown to include unit members
Currently `pastoralUnitMembers` only queries `unit_leader_assignments`. Expand it to also include regular members whose `church_unit` contains "Pastoral Care", deduplicate, and show all in the Assign To dropdown. Only unit leaders (not regular members) can see the Manage/Reassign button — this is already enforced by `isPastoralLeader`.

### Files changed
1. **`src/components/pastoralcare/PastoralCareRequestDialog.jsx`** — add auto-assignment query before insert
2. **`supabase/functions/public-register/index.ts`** — tenant-scope the prayer request assignment
3. **`src/pages/PastoralCare.jsx`** — expand assignee dropdown to include regular Pastoral Care unit members

No database migrations needed.

