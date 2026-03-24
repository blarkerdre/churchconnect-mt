

## Multi-Tenant Migration Progress

### ✅ Phase 1.1 — Tenant Foundation (Complete)
- Created `tenants` table with RLS
- Created `tenant_memberships` table with RLS
- Created helper functions: `user_belongs_to_tenant()`, `is_tenant_admin()`
- Default tenant "Winners Chapel International Cardiff" (slug: `wci-cardiff`, ID: `a0000000-0000-0000-0000-000000000001`)
- Backfilled 2 users into tenant_memberships
- Added `tenant_id` to Batch A tables (members, profiles, user_roles, followups, pastoral_care, notifications, messages)

### ✅ Phase 1.2 — All Tables Get tenant_id (Complete)
- Batch B: attendance_sessions, attendance_records, church_attendance_reports, events, event_registrations, announcements
- Batch C: exam_titles, exam_subjects, exam_questions, exam_sessions, exam_session_courses, exam_attempts, exam_answers, course_registrations, certificate_templates
- Batch D: app_settings, church_units, wsf_centres, wsf_attendance, wsf_attendance_reports, pickup_locations, transportation, books_of_the_month, documents, first_timers, audit_log, email_send_log, training_reports, training_completions, member_status_history, sms_log, unit_leader_assignments, suppressed_emails
- All existing rows backfilled with default tenant ID

### 🔲 Phase 2 — Tenant Context System
- TenantProvider React context
- Path-based routing (`/t/:tenantSlug/...`)
- Supabase client wrapper for tenant-scoped queries

### 🔲 Phase 3 — Tenant-Aware Features
- QR codes, edge functions, notifications, emails, feature flags

### 🔲 Phase 4 — Onboarding Wizard
- Multi-step wizard for new church registration

### 🔲 Phase 5 — Frontend Query Updates
- Update ~50 components to use tenant-scoped queries

### 🔲 Phase 6 — Trigger & Function Updates
- Update all DB triggers to respect tenant boundaries
