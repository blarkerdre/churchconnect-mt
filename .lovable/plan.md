

## Full Audit: Missing `withTenant()` on INSERT/UPDATE Operations

After scanning all `src/` files for `.insert()`, `.upsert()`, and `.update()` calls, here are the gaps found:

### Gaps Requiring Fix

#### 1. `src/components/profile/MemberFeed.jsx` (line 71)
- **Table**: `event_registrations`
- **Issue**: INSERT missing `withTenant()` — `tenant_id` not included
- **Fix**: Wrap payload with `withTenant(payload)`

#### 2. `src/pages/UserManagement.jsx` (line 96)
- **Table**: `user_roles`
- **Issue**: INSERT `{ user_id: userId, role }` — missing `tenant_id`
- **Fix**: Wrap with `withTenant({ user_id: userId, role })`

#### 3. `src/pages/ExamManagement.jsx` (line 903)
- **Table**: `course_registrations`
- **Issue**: INSERT `{ member_id: memberId, course_id: courseId }` — missing `tenant_id`
- **Fix**: Wrap with `withTenant({ member_id: memberId, course_id: courseId })`

#### 4. `src/lib/audit.js` (line 26)
- **Table**: `audit_log`
- **Issue**: Most callers never pass `tenantId` (5th arg). The function only sets `tenant_id` if explicitly provided, so most audit log entries are orphaned (NULL tenant_id).
- **Fix**: Accept `tenantId` as a required-like parameter, OR better: refactor callers to pass it. However, since `logAudit` is a standalone utility without hook access, the cleanest fix is to make all call sites pass the tenant ID. This is a larger change affecting ~15 call sites across 6 files.
- **Pragmatic alternative**: Since audit_log is read-only by admins and scoped by `is_admin(uid, tenant_id)`, the impact is that audit entries with NULL tenant_id are invisible to tenant admins (only super_admins see them). This is a data visibility issue, not a security issue.

### Already Correct (No Change Needed)

These are intentionally tenant-free or correctly scoped:

- **`TenantAdmin.jsx`** — `tenants.insert()` and `tenant_memberships.insert()` — these are super-admin operations creating new tenants; tenant_id is the newly created `data.id`
- **`MemberFormDialog.jsx`** — uses `withTenant()` for user_roles and members inserts ✓
- **All other pages** (Attendance, Communications, Events, Followups, PastoralCare, Transportation, Settings, TrainingReports, ChurchAttendance, ExamManagement questions/titles/sessions) — all use `withTenant()` ✓
- **Component inserts** (MessagingPane, SelfCheckIn, CheckInPanel, RegistrationsDialog, BulkImportDialog, CertificateTemplateSettings, PastoralCareRequestDialog, WSFAttendanceTab, WSFCentresSection, BookOfTheMonthSettings, SubjectManager, ExamSessionManager) — all use `withTenant()` ✓
- **NotificationBell** — user-scoped, intentionally tenant-free ✓

### Summary of Changes

| File | Table | Issue |
|------|-------|-------|
| `MemberFeed.jsx` | `event_registrations` | Missing `withTenant()` on insert |
| `UserManagement.jsx` | `user_roles` | Missing `withTenant()` on insert |
| `ExamManagement.jsx` | `course_registrations` | Missing `withTenant()` on insert |
| `audit.js` + 6 caller files | `audit_log` | Most calls don't pass `tenantId` |

### Implementation

For the first 3 fixes, import `useTenantQuery` (if not already imported) and wrap the insert payload with `withTenant()`.

For `audit.js`, the cleanest approach is to **not change the function signature** but instead update all ~15 call sites to pass `tenantId` as the 5th argument. Each caller already has access to `tenantId` via `useTenantQuery()`.

### Files changed

- **`src/components/profile/MemberFeed.jsx`** — add `withTenant()` to event registration insert
- **`src/pages/UserManagement.jsx`** — add `withTenant()` to user_roles insert
- **`src/pages/ExamManagement.jsx`** — add `withTenant()` to course_registrations insert
- **`src/lib/audit.js`** — no change needed (signature already supports it)
- **`src/pages/UserManagement.jsx`** — pass `tenantId` to all `logAudit` calls
- **`src/pages/Events.jsx`** — pass `tenantId` to all `logAudit` calls
- **`src/pages/Communications.jsx`** — pass `tenantId` to all `logAudit` calls
- **`src/pages/Members.jsx`** — pass `tenantId` to `logAudit` calls
- **`src/components/members/MemberFormDialog.jsx`** — pass `tenantId` to `logAudit` calls

