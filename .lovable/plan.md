

## Multi-Tenant Migration Progress

### ✅ Phase 1.1 — Tenant Foundation (Complete)
- Created `tenants` table with RLS
- Created `tenant_memberships` table with RLS
- Created helper functions: `user_belongs_to_tenant()`, `is_tenant_admin()`
- Default tenant "Winners Chapel International Cardiff" (slug: `wci-cardiff`, ID: `a0000000-0000-0000-0000-000000000001`)
- Backfilled 2 users into tenant_memberships
- Added `tenant_id` to Batch A tables (members, profiles, user_roles, followups, pastoral_care, notifications, messages)

### ✅ Phase 1.2 — All Tables Get tenant_id (Complete)
- Batch B-D: all remaining tables
- All existing rows backfilled with default tenant ID

### ✅ Phase 2 — Tenant Context System (Complete)
- `TenantProvider` context — fetches tenant memberships, auto-selects from URL slug or default
- `useTenantQuery` hook — provides `tenantId`, `withTenant()`, `scopeQuery()`
- Path-based routing with `/t/:tenantSlug/` prefix support

### ✅ Phase 3 — Tenant-Aware Features (Complete)
- QR codes use tenant slug in URLs
- Sidebar branding reads from TenantContext
- Tenant feature flags integrated into useSubFeature

### ✅ Phase 4 — Onboarding Wizard (Complete)
- `register-tenant` edge function — creates tenant, auth user, tenant_membership (owner), user_role (super_admin), profile
- 4-step wizard at `/onboard`: Church Info → Admin Account → Feature Selection → Review & Launch
- Auto sign-in after registration, slug validation, timezone selection
- Link from Auth page ("Sign in instead" / "Already have an account?")

### ✅ Phase 5 — Frontend Query Updates (Complete)
- Updated ~15 page components to use `useTenantQuery` (`scopeQuery` for selects, `withTenant` for inserts)
- Updated shared hooks: `useAppSetting`, `useChurchUnits`, `useUnitMembership`
- Updated shared components: `MemberFormDialog`, `CheckInPanel`, `MemberPastoralHistory`
- Updated `logAudit` to accept optional `tenantId` parameter
- Pages updated: Dashboard, Members, Attendance, Events, Communications, Followups, PastoralCare, Analytics

### ✅ Phase 6 — Trigger & Function Updates (Complete)
- Updated `notify_all_users` to accept optional `_tenant_id` and scope to tenant members
- Updated `notify_new_announcement`, `notify_new_event` to pass tenant_id
- Updated `notify_pastoral_care_change` to propagate tenant_id to notifications
- Updated `track_member_status_change` to propagate tenant_id to status history
- Updated `check_attendance_inactivation` to scope by tenant
- Updated `auto_create_followup` to scope leader assignment and propagate tenant_id
