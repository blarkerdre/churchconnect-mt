## Goal

"Hidden" means hidden from **members only**. Admins & Tenant Owners keep full visibility of every unit and can still assign members to hidden ones — the hidden unit just doesn't appear in any member-facing dropdown or filter.

## Current behaviour

Every consumer uses `useChurchUnits()` which defaults to `activeOnly = true`. That correctly hides units from members, but it *also* hides them from admins on the same screens — so admins can't add a member to a hidden unit, which is wrong.

## Changes

### 1. Role-aware unit lists on admin surfaces

Where an **admin or tenant owner** operates a unit picker/filter, load the full list and visually mark hidden units. Everywhere else keeps the current filtered behaviour.

Files to update (switch to `useChurchUnits(false)` when `isTenantAdmin || isTenantOwner`, otherwise keep default):
- `src/components/members/MemberFormDialog.jsx` — admin editing a member: show hidden units in the picker with a small muted **"Hidden"** badge next to the name.
- `src/components/users/BulkUnitAssignDialog.jsx` — badge hidden units in the unit dropdown.
- `src/components/users/UnitLeaderAssignments.jsx` — same badge treatment.
- `src/components/comms/AudienceFilter.jsx` — admin audience filter includes hidden units (badge).
- `src/components/events/EventFormDialog.jsx` — admin event audience: include + badge.
- `src/components/attendance/SessionFormDialog.jsx` — admin attendance session unit filter: include + badge.
- `src/pages/UnitTasks.jsx` — admin unit selector: include + badge.
- `src/components/followups/SignPostDialog.jsx` — when the current user is admin, include hidden units (leader-only view stays filtered).

Member-facing usage stays unchanged:
- Self-service `MyProfile.jsx`, member-facing branches of `MemberFormDialog` (non-admin), `Communications.jsx` recipient side, `Events.jsx` browse view, `Attendance.jsx` self-check-in, `ChurchUnit.jsx` — all keep the default `activeOnly = true`.

### 2. Small "Hidden" badge component

Reuse the existing Badge with `variant="outline"` and muted styling, e.g. `<Badge variant="outline" className="ml-2 text-[10px] text-muted-foreground">Hidden</Badge>` inside each `SelectItem` / list row for units whose `is_active === false`.

### 3. No backend or approval changes

Approvals (`approve_join_request`) and sign-post "Add to my unit" already write to `members.church_unit` without a visibility check — this stays as-is, since admins are allowed to add members to hidden units. No schema changes.

## Out of scope
- No changes to how members see units (still filtered).
- No changes to `wsf_centres` (Home Cell) visibility.
- No auto-restore of a unit when an admin adds a member to it.

## Verification
- As a **member**: hidden units don't appear in profile edit, event forms, self check-in, audience filters, sign-post targets, or unit-tasks views.
- As an **admin / tenant owner**: hidden units appear in every unit picker/filter across Members, Users, Communications, Events, Attendance, Unit Tasks, Sign-post — each labelled "Hidden". Assigning a member to a hidden unit succeeds and persists.
- Toggling a unit back to visible removes the "Hidden" badge for admins and makes it reappear for members.
