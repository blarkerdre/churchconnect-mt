## Goal
Make the Reports Officer role truly **read-only** across all modules it can access, hide admin-only panels (App Feedback) from them, and confirm they cannot reach Settings / System Logs / User Management.

## Current state
- Routes: `Settings`, `System Logs`, `User Management` are already gated by `AdminRoute` (admin only). Reports Officer is correctly blocked. ✓
- `ReportsRoute`, `WSFRoute`, `LeaderRoute`, `FollowupRoute`, `TrainingRoute` all let `isReportsOfficer` through, but the pages they render expose full create/edit/delete actions.
- `Analytics` page renders `<FeedbackSummary />` (App Feedback) inside the **Reports** tab for everyone — Reports Officer can currently see it.

## Plan

### 1. New shared read-only signal
Add `isReadOnly` to `useAuth` (in `src/hooks/useAuth.jsx`):
```js
const isReadOnly = isReportsOfficer && !isAdmin && !isUnitLeader && !isWSFLeader;
```
Expose it from the context value so any component can do `const { isReadOnly } = useAuth()`.

### 2. Hide App Feedback for Reports Officer in Analytics
In `src/pages/Analytics.jsx`:
- Render `<FeedbackSummary />` only when `isAdmin` (already imported `useAuth`). Reports Officer will still see Member Milestone and Status Conversion reports (admin-gated today — keep them visible to reports officer too in read-only mode? See Q1 below).

### 3. Enforce read-only in every reportable module
For each page/component reachable by Reports Officer, hide or disable mutation UI when `isReadOnly`:

Pages to update:
- `src/pages/Members.jsx` — hide "Add Member", "Bulk Import", row edit/delete, status change buttons.
- `src/pages/ChurchAttendance.jsx` — hide session create / record entry / delete.
- `src/pages/Attendance.jsx` — hide "New Session", check-in actions, delete.
- `src/pages/WSFManagement.jsx` — hide centre/report create/edit/delete; keep view tabs.
- `src/pages/Followups.jsx` — hide new follow-up, status change, message-send, sign-post actions.
- `src/pages/PastoralCare.jsx` — hide request create, assign, status update, delete.
- `src/pages/Events.jsx` — hide create/edit/delete, registration management (keep list + registrations view).
- `src/pages/Communications.jsx` — hide announcement create/edit/delete, SMS/email send forms.
- `src/pages/Transportation.jsx` — hide booking create, assign, status change.
- `src/pages/TrainingReports.jsx` — already mostly read-only; hide any action buttons.
- `src/pages/UnitTasks.jsx` — hide task create/edit/delete/acknowledge.
- `src/pages/ExamManagement.jsx` — hide subject/session create, grading, danger actions; keep CourseResultsView.
- `src/pages/Testimony.jsx` — hide create/edit/delete (read-only listing only).
- `src/pages/Analytics.jsx` — disable "Download Report" only if you also want exports blocked (see Q2).

Implementation pattern in each page:
```jsx
const { isReadOnly } = useAuth();
// ...
{!isReadOnly && <Button onClick={openCreate}>New …</Button>}
```
For row-level edit/delete inside list components, pass `readOnly` (or read from `useAuth` inside the row component) and conditionally render the action menu.

### 4. Defense in depth on routes
Leave existing routes as-is (Reports Officer still navigates in), but rely on UI gating + RLS on the DB layer. No new route guards required.

## Open questions

**Q1.** Should Reports Officer see the `MemberMilestoneReport` and `StatusConversionReport` panels in Analytics → Reports (currently `isAdmin`-only)? If yes, change the gate from `isAdmin` to `isAdmin || isReportsOfficer` and hide their messaging/CTA buttons in read-only mode.

**Q2.** Should Reports Officer be able to **download / export reports** (CSV, print)? Default in this plan: yes — read-only means no mutations, but exports are still allowed. If you want exports blocked, say so.

**Q3.** Confirm Reports Officer should still appear in the sidebar role label and have the same nav items they have today (Analytics, Members, Attendance, WSF, Followups, Training Reports, Church Attendance, Reports Hub). No nav changes are in this plan.

## Files changed
- `src/hooks/useAuth.jsx` (add `isReadOnly`)
- `src/pages/Analytics.jsx` (hide FeedbackSummary for non-admins; optionally expose milestone/conversion to reports officer)
- ~13 module pages listed above (conditional rendering of action buttons)
- A handful of list/row components (`MemberTable`, `EventCard`, `PastoralCareCard`, `AnnouncementCard`, `FollowupDetailPanel`, etc.) to hide row-level actions when `isReadOnly`

No DB / RLS / edge function changes.