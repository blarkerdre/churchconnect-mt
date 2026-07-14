## Goal

Allow a Home Cell's **House Provider** (the member set as `host_member_id` on a `wsf_centres` row) to record and view attendance for that centre — same rights the centre's Leader already has. Admins/Reports Officers behaviour is unchanged. Providers only get access to the centre(s) they host.

## Backend (RLS)

Update two security-definer helpers so both leader **and** host qualify as "leader of this centre":

- `public.is_wsf_leader_for_centre(_user_id, _centre_id)` — currently checks `wc.leader_id = m.id`. Extend to also match `wc.host_member_id = m.id`.
- `public.is_home_cell_leader_for_centre(_user_id, _centre_id, _tenant_id)` — same extension.

No RLS policy rewrites needed; the existing policies on `wsf_attendance_reports` (and any others that call these helpers) automatically start accepting hosts. No new column, no new grants.

## Frontend

1. `src/components/wsf/WSFAttendanceTab.jsx` (line 42)
   - Change `ledCentres` filter to include centres where `c.host_member_id === userMember.id` in addition to `c.leader_id === userMember.id`.
   - `canWrite` / `canAccess` derive from `ledCentres`, so hosts get the "Record Attendance" button and can see their own centre's reports automatically.

2. `src/pages/WSFManagement.jsx`
   - Access gate at line 92: also allow when the user hosts at least one centre (compute `isHomeCellHost` from `centres` + `myMember.id`).
   - `myMember` query at line 27: enable it whenever `user?.id` is set and not admin (so hosts without the `wsf_leader` role still get their member id).
   - `ledCentres` at line 71: include centres where `host_member_id === myMember.id`.

3. `src/components/dashboard/WSFLeaderDashboard.jsx`
   - Query "centres this user leads" (line 30) so it returns centres matched by `leader_id` **or** `host_member_id` (single query with `.or("leader_id.eq.<id>,host_member_id.eq.<id>")`).
   - Empty-state copy stays; it now triggers only when the user neither leads nor hosts.

4. Routing / sidebar entry to `/wsf` (Home Cell page) — verify hosts can navigate there. If the sidebar link is gated purely on `isWSFLeader`, extend the gate to also show it when the user hosts a centre. (I'll confirm in the implementation pass; likely one condition in `AppLayout.jsx` / nav config.)

## Out of scope

- No new role, no changes to `user_roles`, no changes to who can create/edit centres.
- Reports Officer, Admin, Unit Leader logic untouched.
- Home Cell join-request approval and other host-only flows remain as they are today.

## Technical notes

- Both helper functions are `SECURITY DEFINER STABLE` — replacing them with `CREATE OR REPLACE FUNCTION` keeps existing grants and policy references intact.
- `host_member_id` is already tenant-scoped via `wsf_centres.tenant_id`, so the extended predicate stays inside the tenant boundary.
