

## Fix Tenant Delete in archive-tenant Edge Function

### Root Cause
The `archive-tenant` edge function's delete action is missing ~9 tables that have `tenant_id` columns. When it tries to delete `tenant_memberships`, `members`, or the tenant itself, foreign key constraints from these undeleted tables block the operation — causing a silent 500 error.

### Missing tables (not deleted before tenant removal)
- `user_roles`
- `training_completions`
- `training_reports`
- `transportation`
- `wsf_attendance`
- `wsf_attendance_reports`
- `unit_leader_assignments`
- `suppressed_emails`
- `purged_data_archives`

### Fix
Update `supabase/functions/archive-tenant/index.ts`:

1. Add all missing tables to the deletion list, in correct FK-safe order
2. Update CORS headers to include the full set (matching other edge functions)
3. Add error logging per-table so failures are visible in logs

Updated table list (FK-safe order):
```text
tenant_invitations, notifications, messages, audit_log,
exam_answers, exam_attempts, exam_questions, exam_session_courses,
exam_sessions, exam_subjects, exam_titles, course_registrations,
training_completions, training_reports,
attendance_records, attendance_sessions,
wsf_attendance, wsf_attendance_reports,
event_registrations, events,
followups, first_timers, pastoral_care, member_status_history,
documents, sms_log, email_send_log, suppressed_emails,
church_attendance_reports, transportation,
pickup_locations, certificate_templates, books_of_the_month,
announcements, app_settings,
unit_leader_assignments, user_roles,
members, church_units, wsf_centres, wsf_zones,
purged_data_archives, tenant_memberships, profiles
```

Then delete the tenant row last.

### Files changed
- `supabase/functions/archive-tenant/index.ts` — add missing tables, fix CORS headers, add per-table error logging
- Redeploy `archive-tenant`

No database migration needed.

