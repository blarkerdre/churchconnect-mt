## Add Follow-up & Sign-Post Reports

Today the Follow-ups page only exports a flat CSV/print of the current filtered list — no grouping, no signpost coverage. Add a dedicated **Reports** dialog on the Follow-ups page that lets admins/unit leaders generate filtered, grouped reports across follow-ups **and** sign-post referrals.

### 1. New component: `FollowupReportDialog.jsx`
Location: `src/components/followups/FollowupReportDialog.jsx`

Filters (all optional, combinable):
- **Report type**: Follow-ups · Sign-Posts (referrals) · Combined
- **Date range** (created/due/completed — selectable basis)
- **Status**: multi-select (Pending, In Progress, Completed, Overdue — and for referrals: pending, accepted, declined, completed)
- **Follow-up type**: multi-select (First Timer, New Convert, Visitor, Absentee, Pastoral, etc.)
- **Assigned to**: member/leader picker (or "Unassigned")
- **Priority**: Low/Medium/High/Urgent
- **Group by**: None · Assigned Member · Status · Type · Referral Target

Output:
- Summary cards: total, by status, overdue count, completion rate, avg days to complete
- Grouped table preview
- **Export**: CSV download + Print (reuse `PrintReportButton` pattern)
- For Sign-Posts: include referral type, target unit/centre, assigned leader, current status, latest update note

### 2. Data fetching
- Reuse current `followups` query plus a new `followup_referrals` query joined to `followups`, `members`, `wsf_centres`, profiles for assigned leader names — all tenant-scoped with explicit `.eq("tenant_id", tenantId)`.
- For "Combined" mode, list each follow-up with its referral(s) inline.

### 3. Hook into Follow-ups page
`src/pages/Followups.jsx`: add a **"Generate Report"** button (next to existing Download/Print) for admins & unit leaders, opening the new dialog. Existing quick CSV/Print buttons stay as-is.

### 4. Access control
Same gate as current export: `isAdmin || isUnitLeader`. Unit leaders see only follow-ups/referrals within their assigned scope (already enforced by RLS).

### Out of scope
- No DB schema changes (existing tables cover everything).
- No new routes — lives inside Follow-ups page.
- No scheduled/email-delivered reports.

### Files touched
- **New**: `src/components/followups/FollowupReportDialog.jsx`
- **Edit**: `src/pages/Followups.jsx` (add button + dialog mount)
