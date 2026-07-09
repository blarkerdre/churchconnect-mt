## Goal
Allow Admins and Follow-up Unit Leaders to reverse a completed follow-up back to **In Progress**.

## Change
In `src/components/followups/FollowupDetailPanel.jsx`:

1. When `followup.status === "Completed"` AND `canManage` is true, show a new **"Reopen (Mark In Progress)"** button in the Quick Actions area.
2. Clicking it calls `onUpdate(followup.id, { status: "In Progress", completed_date: null })`, clearing the completion date so stats/exports stay accurate.
3. Small confirm prompt ("Reopen this completed follow-up?") to prevent accidents.
4. Show a success toast after the update.

## Access control
Reuses existing `canManage` prop passed from `src/pages/Followups.jsx`, which is `isAdmin || isFollowupTeam` (Follow-up unit leader/member). No new role logic, no DB changes.

## Out of scope
- No schema/RLS changes (existing follow-up update policy already permits admins and follow-up unit members).
- No changes to the list view badges or filters.
