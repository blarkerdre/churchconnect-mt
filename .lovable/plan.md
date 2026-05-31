## Reports Officer Role

Add a new app-level role that can view and generate comprehensive reports across all modules, **read-only** — no edit/create/delete of underlying records.

### 1. New role: `reports_officer`

- Add `'reports_officer'` to the `app_role` enum.
- Assignable by tenant owners/admins from **User Management** (alongside existing role checkboxes).
- Hidden from public/self-signup (same pattern as other privileged roles per existing Role Assignment UI rule).

### 2. Permissions model

Add a helper:
```sql
public.is_reports_officer(_user_id uuid, _tenant_id uuid) returns boolean
```

Extend RLS **SELECT** policies on these tables so a reports_officer in the same tenant can read all rows (tenant-scoped):
- `members`, `member_status_history`
- `attendance_sessions`, `attendance_records`, `unit_meeting_*`
- `church_attendance_*`
- `followups`, `followup_referrals`, `followup_referral_updates`
- `events`, `event_registrations`
- `announcements`, `sms_log`, `email_log`, `notifications`
- `pastoral_care_*`, `prayer_requests`
- `transport_bookings`
- `unit_tasks`, `unit_task_assignments`, `unit_task_comments`
- `wsf_centres`, `wsf_attendance_*` (Home Cell)
- `exam_sessions`, `exam_attempts`, `course_registrations`, `exam_subjects` (Bible School)
- `training_*` (BFC/BCC/LCC/LDC)
- `member_feed` / journey-related views

No INSERT/UPDATE/DELETE grants — purely read.

### 3. Reports Hub page (`/t/:slug/reports`)

A single hub the reports_officer (and admins/owners) land on, with one card per module. Each card opens the **existing** report dialog/view for that module — we are not rebuilding report logic, just centralising access.

Modules surfaced (reusing existing components):
- Analytics → `pages/Analytics.jsx` (Member Milestone, Status Conversion, Announcement, Absence)
- Church Attendance → `pages/ChurchAttendance.jsx` report view
- Unit Attendance → existing attendance report in `Attendance.jsx`
- Home Cell → WSF attendance report in `WSFManagement.jsx`
- Members → directory export + Member Journey timeline
- Follow-ups → `FollowupReportDialog`
- Sign-Posts → existing sign-post inbox report
- Prayer Requests / Pastoral Care → existing pastoral care reports
- Events → registrations export from `RegistrationsDialog`
- Communications → announcement + SMS history reports
- Transportation → existing transport report
- Training Reports → `pages/TrainingReports.jsx`
- Unit Tasks → `UnitTaskReportDialog`
- Bible School → `CourseResultsView` + session reports

Each card: icon, title, short description, "Open report" button. Filterable by date range at the top (passed as default into each dialog where supported).

### 4. Navigation & gating

- Add **Reports** sidebar entry (in `AppLayout.jsx`) visible to: `super_admin`, tenant owner/admin, `reports_officer`.
- Route registered in `App.jsx` as `/t/:tenantSlug/reports`.
- `useAuth` exposes `isReportsOfficer` derived from `roles.includes('reports_officer')`.
- Where existing report dialogs are currently gated by `isAdmin`, widen the check to `isAdmin || isReportsOfficer`.

### 5. Audit

- Every report opened/exported by a reports_officer is logged via existing `logAudit` util (`action: 'report_view'` / `'report_export'`, entity = module key). Provides accountability since the role sees cross-member data.

### Out of scope
- Building any new reports — only centralising and granting access to what exists.
- Editing data, sending messages, or any write operations from this role.
- Cross-tenant reporting (role is strictly tenant-scoped).

### Files

**Migration (new):** add enum value, `is_reports_officer()` helper, extend SELECT policies on the tables listed above, audit-log entries.

**New:** `src/pages/Reports.jsx`, `src/components/reports/ReportCard.jsx`.

**Edited:** `src/App.jsx` (route), `src/components/AppLayout.jsx` (nav), `src/hooks/useAuth.jsx` (`isReportsOfficer`), `src/pages/UserManagement.jsx` + `src/components/users/...` (role assignment UI), report dialog gates across the modules listed.
