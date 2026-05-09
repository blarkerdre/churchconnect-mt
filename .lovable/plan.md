## Problem

On a follow-up's **Reassign** dropdown (FollowupDetailPanel), the list includes people who are not on the Follow-up team — e.g. any admin/owner, any unit leader of any unit, any WSF (Home Cell) leader. That's why the names look wrong.

## Root cause

In `src/pages/Followups.jsx` (the `followup-reassign-candidates` query, lines ~58–98), the candidate set is the **union** of four queries:

1. Leaders of the Follow-up unit (`unit_leader_assignments` where `unit_name ilike '%follow%'`) ✅ correct
2. Members whose `church_unit` includes "follow-up" / "follow up" ✅ correct
3. **Anyone with role `admin`, `unit_leader`, or `wsf_leader`** in `user_roles` ❌ too broad — this is what's polluting the list (every unit leader and Home Cell leader gets added, regardless of unit)
4. **Anyone with tenant role `owner` or `admin`** in `tenant_members` ❌ also too broad — every tenant admin appears

The comment said this was a "graceful fallback so admins always see something", but in practice it makes the list look incorrect.

## Fix

Edit `src/pages/Followups.jsx` only.

Tighten the `followup-reassign-candidates` query to return **only true Follow-up team members**:

- Keep query 1: Follow-up unit leaders (`unit_leader_assignments` ilike `%follow%`).
- Keep query 2: Members in the Follow-up church unit.
- **Remove query 3** (broad `user_roles` lookup).
- **Remove query 4** (broad `tenant_members` admin/owner lookup).

Result: the dropdown only shows users who actually belong to the Follow-up team (leader assignment or `church_unit` contains "Follow-up"), minus the currently-assigned person.

The existing empty-state message already reads: *"No other team members available. Add users to the Follow-up unit in User Management."* — which now correctly guides the admin if the team is empty.

## Out of scope

- Reassign UI/permissions in `FollowupDetailPanel.jsx` (unchanged).
- The `assigned_to` picker in `FollowupFormDialog.jsx` (already uses Follow-up unit members only).
- Adding a separate "include admins" toggle (can be added later if requested).

## Verification

- Open a follow-up as admin → click **Reassign** → dropdown lists only Follow-up unit leaders + members of the Follow-up church unit, excluding the current assignee.
- A unit leader for a non-Follow-up unit (e.g. Choir) no longer appears.
- A tenant admin who is not on the Follow-up team no longer appears.
- If the Follow-up team is empty, the existing italic empty-state message shows.
