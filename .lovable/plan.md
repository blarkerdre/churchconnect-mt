# Tenant-scoping sweep across all features

Most of the app already routes reads and writes through the tenant helpers (`scopeQuery`, `withTenant` from `useTenantQuery`). A full scan of every database call in `src/` found about 40 remaining calls, in 28 files, that do not carry a tenant guard and are not one of the deliberate cross-tenant exceptions. This plan closes those, then adds a guard so the gap cannot silently reopen.

## Deliberate exceptions (left cross-tenant on purpose)

- Sermon notes and sermon folders — single personal library across churches, as previously agreed.
- Super Admin / Tenant Admin surfaces — tenants, pricing, platform alerts, invoices, SLA templates, platform users.
- User-owned rows keyed by `user_id` only — tour completions, push subscriptions, profile/MFA self-updates, notifications.
- Trustpilot reviews and settings — public marketing content on the landing page.

## Phase 1 — Member, pastoral, comms and attendance data (highest leak risk)

Add explicit tenant guards to:

- `AudienceFilter.jsx` (home cell centres, members), `SMSDialog.jsx` (members)
- `Communications.jsx` and `EmailDashboard.jsx` (SMS log, email log)
- `SystemLogs.jsx` (email log, SMS log, call log, audit log) and `src/lib/audit.js` (audit writes)
- `ChurchAttendance.jsx` (attendance reports)
- `useAuth.jsx` (unit leader assignments, member lookup, home cell centre) and `useChurchUnits.jsx`
- `SignPostDialog.jsx` (referral insert), `FollowupTemplatesSection.jsx`
- `MemberFeed.jsx` (event registrations), `ReportAttachments.jsx` (documents)

## Phase 2 — Bible School, training, inventory

- `SessionManager.jsx` (sessions, session courses), `CourseReportTab.jsx`, `CourseResultsView.jsx`, `QcCheckDialog.jsx`, `ExamManagement.jsx` (subject lookup)
- `TrainingReports.jsx`, `TrainingAttendeesPanel.jsx`
- `InspectionDialog.jsx`, `InventoryItemDialog.jsx`

## Phase 3 — Children/teens, family, feedback, user admin

- `MyFamily.jsx` (guardians, preteens), `PreteensSection.jsx` (teens lookup), `PreteensAttendance.jsx` (sessions)
- `AppFeedbackDialog.jsx`, `FeedbackSummary.jsx`
- `BulkUnitAssignDialog.jsx` (unit leader assignments)

## Phase 4 — Database-level hardening

For the tables touched above, verify each has a `tenant_id` column that is `NOT NULL` where the data model allows, and review the RLS policies so a missing client-side filter cannot leak rows. Any policy that reads a row without a tenant-membership check gets tightened in a single migration. Client filters are defence in depth; RLS stays the real boundary.

## Technical notes

- Every fix uses the existing helpers rather than hand-written filters: reads become `scopeQuery(supabase.from(...)...)`, inserts become `.insert(withTenant(payload))`, and updates/deletes get an explicit `.eq("tenant_id", tenantId)`.
- Queries whose cache keys omit the tenant get `tenantId` added to the React Query key so switching churches refetches instead of serving another church's cached rows.
- Cross-tenant exceptions above are annotated in code with a short comment so future scans and reviewers do not "fix" them by mistake.
- Verification: after each phase, re-run the repo-wide scan script and confirm the remaining hits are only the annotated exceptions, then build the app.
