

## Rename All UI-Facing "WSF" to "Home Cell"

### Scope
Replace every user-visible "WSF" string with "Home Cell" equivalents across the entire frontend. Database table/column names (e.g. `wsf_centres`, `wsf_zones`, `winners_satellite`) remain unchanged — only UI labels, headings, tooltips, comments, and display text are affected.

**Note**: The `session_type` enum value `'WSF Meeting'` stored in the database will be renamed to `'Home Cell Meeting'` via a migration to keep data consistent with the UI.

### Key Renaming Map
| Current | New |
|---------|-----|
| WSF Meeting | Home Cell Meeting |
| WSF Attendance | Home Cell Attendance |
| WSF Centre(s) | Home Cell Centre(s) |
| WSF Leader(s) | Home Cell Leader(s) |
| WSF Leader Dashboard | Home Cell Leader Dashboard |
| WSF Leader View | Home Cell Leader View |
| WSF data | Home Cell data |
| wsf-attendance-report.csv | home-cell-attendance-report.csv |

### Files to Update (~20 files)

**Pages:**
- `src/pages/WSFManagement.jsx` — headings
- `src/pages/Attendance.jsx` — session type labels, locked type display, comments
- `src/pages/Analytics.jsx` — chart titles, stat labels, CSV section header
- `src/pages/Events.jsx` — audience list items ("WSF", "WSF Leaders" → "Home Cell", "Home Cell Leaders"), comments
- `src/pages/Communications.jsx` — comments
- `src/pages/Presentation.jsx` — slide titles and descriptions
- `src/pages/Members.jsx` — comments
- `src/pages/MyProfile.jsx` — "WSF Centre" label
- `src/pages/PublicRegistration.jsx` — "WSF Centre" label, placeholder
- `src/pages/Settings.jsx` — no change needed (already says "Home Cell")
- `src/pages/TenantAdmin.jsx` — already says "Home Cell" (verify only)

**Components:**
- `src/components/wsf/WSFAttendanceTab.jsx` — print title, error message, download filename
- `src/components/wsf/WSFAttendanceFormDialog.jsx` — no WSF strings (already clean)
- `src/components/wsf/WSFCentreFormDialog.jsx` — dialog titles if any
- `src/components/wsf/WSFCentreMembersDialog.jsx` — check for WSF strings
- `src/components/dashboard/WSFLeaderDashboard.jsx` — heading, empty state, fallback text
- `src/components/dashboard/MemberDashboard.jsx` — milestone label "WSF" → "Home Cell"
- `src/components/dashboard/GrowthIndices.jsx` — check for WSF label
- `src/components/events/EventFormDialog.jsx` — audience list
- `src/components/settings/DangerZoneSection.jsx` — "WSF centres" text
- `src/components/settings/WSFZonesSection.jsx` — already says "Home Cell Zones" (verify)
- `src/components/notifications/NotificationBell.jsx` — comment only
- `src/components/AppLayout.jsx` — comments only (nav label already "Home Cell Report")
- `src/components/users/WSFLeaderAssignments.jsx` — check labels

**Utilities:**
- `src/lib/wsf-suggest.js` — JSDoc comments

**Database migration:**
- Rename the `session_type` enum value from `'WSF Meeting'` to `'Home Cell Meeting'`
- Update existing `attendance_sessions` rows
- Update the `is_wsf_leader_for_session` function to match `'Home Cell Meeting'`

### What Stays Unchanged
- All database table names (`wsf_centres`, `wsf_zones`, `wsf_attendance_reports`)
- All database column names (`wsf_centre_id`, `winners_satellite`)
- All JS variable names (`isWSFLeader`, `wsfCentres`, `wsfAnalytics`)
- File names (component files keep their names)
- Internal query keys and code identifiers

