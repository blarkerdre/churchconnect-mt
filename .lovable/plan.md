## Goal
Lock down Training Report (and only Training Report — Church Attendance left as-is) so it is visible to: Super Admins, Admins, any Unit Leader, and members of the **Training Rep** unit. Reports Officers retain read-only access.

## Frontend

**`src/App.jsx` — new `TrainingReportRoute` guard** (mirrors `FollowupRoute`):
- Uses `useUnitMembership("Training Rep")` plus `isAdmin / isSuperAdmin / isUnitLeader / isReportsOfficer`.
- Redirects to tenant root if none match.
- Wrap only the `/training-reports` route with it (keep `/church-attendance` on existing `TrainingRoute`).

**`src/components/AppLayout.jsx`** — sidebar visibility:
- Add a new access tag `training_report` for the Training Report nav item (keep Church Attendance on `training`).
- Call `useUnitMembership("Training Rep")` to get `isTrainingRepMember`.
- Visibility rule: `isAdmin || isSuperAdmin || isUnitLeader || isTrainingRepMember || isReportsOfficer`.

## Backend (RLS on `public.training_reports`)

Single migration replacing the two existing policies:

- `Authorized users can view training reports` (SELECT):
  `is_admin(auth.uid(), tenant_id)` OR `has_role(auth.uid(), 'super_admin')` OR `has_role(auth.uid(), 'unit_leader', tenant_id)` OR `has_role(auth.uid(), 'reports_officer', tenant_id)` OR `user_is_unit_member(auth.uid(), 'Training Rep', tenant_id)`.
- `Authorized users can manage training reports` (ALL):
  Same as above minus `reports_officer` (read-only). USING + WITH CHECK identical.

Reuses the existing `user_is_unit_member` SECURITY DEFINER helper (case-insensitive, trimmed, comma-split on `members.church_unit`) already added in a prior migration.

## Out of scope
- No changes to Church Attendance access.
- No new unit auto-creation — relies on the tenant already having a unit named "Training Rep" (case-insensitive match) and members having it in their `church_unit`.
