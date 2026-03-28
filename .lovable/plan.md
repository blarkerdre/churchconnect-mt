

## Fix: Tenant Isolation Gaps Across All App Features

### Audit Summary

I reviewed all 49+ files with database queries. Most SELECT queries correctly use `scopeQuery()` and most INSERTs use `withTenant()`. However, many UPDATE and DELETE mutations only filter by `.eq("id", id)` without adding `.eq("tenant_id", tenantId)`. While RLS policies provide server-side protection, adding client-side tenant scoping is defense-in-depth and prevents accidental cross-tenant operations if RLS has gaps.

### Issues Found

#### Category 1: UPDATE mutations missing `.eq("tenant_id", tenantId)`

| File | Table | Line |
|---|---|---|
| `src/pages/Transportation.jsx` | `transportation` | 106 |
| `src/pages/Transportation.jsx` | `pickup_locations` | 132, 150 |
| `src/pages/Followups.jsx` | `followups` | 117, 133 |
| `src/pages/Followups.jsx` | `members` | 149 |
| `src/pages/PastoralCare.jsx` | `pastoral_care` | 122 |
| `src/pages/Attendance.jsx` | `attendance_sessions` | 95, 107 |
| `src/pages/Communications.jsx` | `announcements` | 156 |
| `src/pages/Events.jsx` | `events` | 189 |
| `src/pages/Settings.jsx` | `church_units` | 242 |
| `src/pages/ExamManagement.jsx` | `exam_titles` | 91 |
| `src/pages/ExamManagement.jsx` | `exam_questions` | 141 |
| `src/pages/ExamManagement.jsx` | `exam_sessions` | 67, 110 |
| `src/components/settings/WSFCentresSection.jsx` | `wsf_centres` | 89 |
| `src/components/settings/WSFZonesSection.jsx` | `wsf_zones` | 46 |
| `src/components/settings/BookOfTheMonthSettings.jsx` | `books_of_the_month` | 50 |
| `src/components/events/RegistrationsDialog.jsx` | `event_registrations` | 48 |
| `src/components/members/MemberFormDialog.jsx` | `members` | 103, 122, 213 |
| `src/components/attendance/CheckInPanel.jsx` | `attendance_sessions` | 86 |
| `src/components/notifications/NotificationBell.jsx` | `notifications` | 60, 67 |

#### Category 2: DELETE mutations missing `.eq("tenant_id", tenantId)`

| File | Table | Line |
|---|---|---|
| `src/pages/Transportation.jsx` | `transportation` | 119 |
| `src/pages/Communications.jsx` | `announcements` | 175 |
| `src/pages/Events.jsx` | `events` | 221 |
| `src/pages/Members.jsx` | `members` | 74 |
| `src/pages/Settings.jsx` | `church_units` | 259 |
| `src/pages/ExamManagement.jsx` | `exam_titles` | 110 |
| `src/pages/ExamManagement.jsx` | `exam_questions` | 160 |
| `src/pages/ExamManagement.jsx` | `exam_sessions` | 94 |
| `src/pages/ExamManagement.jsx` | `course_registrations` | 636 |
| `src/components/settings/WSFCentresSection.jsx` | `wsf_centres` | 107 |
| `src/components/settings/WSFZonesSection.jsx` | `wsf_zones` | 64 |
| `src/components/events/RegistrationsDialog.jsx` | `event_registrations` | 56 |
| `src/components/exams/SubjectManager.jsx` | `exam_subjects` | 57 |
| `src/components/exams/ExamSessionManager.jsx` | `exam_sessions` | 94 |
| `src/components/exams/ExamSessionManager.jsx` | `exam_session_courses` | 71 |
| `src/components/certificates/CertificateTemplateSettings.jsx` | `certificate_templates` | 91 |
| `src/components/attendance/CheckInPanel.jsx` | `attendance_records` | 70 |
| `src/components/reports/ReportAttachments.jsx` | `documents` | 38 |
| `src/components/notifications/NotificationBell.jsx` | `notifications` | 74 |

#### Category 3: Missing tenantId in React Query cache keys

Some `invalidateQueries` calls use generic keys without `tenantId`, which could serve stale cross-tenant data:
- `src/pages/Transportation.jsx` — `queryKey: ["transportation"]` on invalidation (line 97, 110, 123)
- `src/pages/Followups.jsx` — `queryKey: ["followups"]` on invalidation (line 125, 138, 164)
- Various `queryClient.invalidateQueries` calls throughout the app

#### Category 4: Notifications — user-scoped but missing tenant filter

`NotificationBell.jsx` queries by `user_id` only. This is intentional (user-scoped exception per architecture), but the realtime subscription also lacks tenant filtering. Notifications already have `tenant_id` in the table, so this is acceptable.

### Approach

The fix pattern for every mutation is simple — append `.eq("tenant_id", tenantId)` to UPDATE/DELETE queries. This is defense-in-depth on top of RLS.

For notifications: leave as user-scoped (documented exception).

For cache keys on invalidation: add `tenantId` to ensure tenant-partitioned cache.

### Files to change

All 19 files listed above. The changes are mechanical — add `.eq("tenant_id", tenantId)` to each UPDATE/DELETE call and ensure invalidation query keys include `tenantId`.

Specifically:
1. `src/pages/Transportation.jsx`
2. `src/pages/Followups.jsx`
3. `src/pages/PastoralCare.jsx`
4. `src/pages/Attendance.jsx`
5. `src/pages/Communications.jsx`
6. `src/pages/Events.jsx`
7. `src/pages/Settings.jsx`
8. `src/pages/ExamManagement.jsx`
9. `src/pages/Members.jsx`
10. `src/components/settings/WSFCentresSection.jsx`
11. `src/components/settings/WSFZonesSection.jsx`
12. `src/components/settings/BookOfTheMonthSettings.jsx`
13. `src/components/events/RegistrationsDialog.jsx`
14. `src/components/members/MemberFormDialog.jsx`
15. `src/components/attendance/CheckInPanel.jsx`
16. `src/components/exams/SubjectManager.jsx`
17. `src/components/exams/ExamSessionManager.jsx`
18. `src/components/certificates/CertificateTemplateSettings.jsx`
19. `src/components/reports/ReportAttachments.jsx`

### No database changes needed

RLS already protects at the server level. These client-side additions are defense-in-depth.

