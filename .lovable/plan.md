

## Multi-Tenant Migration Progress

### ✅ Phase 1.1 — Tenant Foundation (Complete)
- Created `tenants` table with RLS
- Created `tenant_memberships` table with RLS
- Created helper functions: `user_belongs_to_tenant()`, `is_tenant_admin()`
- Default tenant "Winners Chapel International Cardiff" (slug: `wci-cardiff`, ID: `a0000000-0000-0000-0000-000000000001`)
- Backfilled 2 users into tenant_memberships
- Added `tenant_id` to Batch A tables (members, profiles, user_roles, followups, pastoral_care, notifications, messages)

### ✅ Phase 1.2 — All Tables Get tenant_id (Complete)
- Batch B-D: all remaining tables (attendance, events, exams, settings, WSF, etc.)
- All existing rows backfilled with default tenant ID

### ✅ Phase 2 — Tenant Context System (Complete)
- `TenantProvider` context — fetches tenant memberships, auto-selects from URL slug or default
- `useTenantQuery` hook — provides `tenantId`, `withTenant()`, `scopeQuery()`
- Path-based routing with `/t/:tenantSlug/` prefix support

### ✅ Phase 3 — Tenant-Aware Features (Complete)
- QR codes use tenant slug in URLs (`/t/:slug/register`, `/t/:slug/wofbi-register`)
- Sidebar branding reads tenant name/logo from TenantContext (falls back to Winners Chapel logo)
- Tenant feature flags in `tenants.settings.features` integrated into `useSubFeature` and `useTenantFeatureEnabled`
- SMS-related sub-features auto-disabled when tenant has `sms_enabled: false`

### 🔲 Phase 4 — Onboarding Wizard
- Multi-step wizard for new church registration

### 🔲 Phase 5 — Frontend Query Updates
- Update ~50 components to use tenant-scoped queries

### 🔲 Phase 6 — Trigger & Function Updates
- Update all DB triggers to respect tenant boundaries
