

## Tenant-Isolate All Remaining App Features

### Gaps Found

After auditing the full codebase, these components query the database **without tenant scoping**:

#### 1. `src/components/users/UnitLeaderAssignments.jsx`
- **SELECT** `unit_leader_assignments` by `user_id` only — no tenant filter, no tenant in query key
- **INSERT** missing `tenant_id`
- **DELETE** no tenant filter

#### 2. `src/components/users/BulkUnitAssignDialog.jsx`
- **SELECT** `user_roles` with no tenant filter (gets leaders from all tenants)
- **SELECT** `profiles` with no tenant filter
- **SELECT** `unit_leader_assignments` by unit name only — no tenant filter
- **INSERT** `unit_leader_assignments` missing `tenant_id`

#### 3. `src/components/certificates/IssueCertificateDialog.jsx`
- **SELECT** `app_settings` for `training_types` — no tenant filter, no `tenantId` in query key
- **SELECT** `exam_titles` — no tenant filter, no `tenantId` in query key

#### 4. `src/components/certificates/MyCertificates.jsx`
- Queries `training_completions` by `member_id` only — acceptable (member_id is already scoped), but query key should include `tenantId` for cache isolation

#### 5. `src/pages/PastoralCare.jsx` (~line 63)
- **SELECT** `unit_leader_assignments` for pastoral unit members — no tenant filter, no `tenantId` in query key

#### 6. `src/pages/Followups.jsx` (~line 57)
- **SELECT** `unit_leader_assignments` for follow-up unit members — no tenant filter, no `tenantId` in query key

### Already Scoped (No Changes Needed)
- `ExternalLinksSection.jsx` — already fixed
- `BookOfTheMonth.jsx`, `BookOfTheMonthSettings.jsx` — already use `scopeQuery`
- `CertificateTemplateSettings.jsx` — already uses `scopeQuery`/`withTenant`
- `NotificationBell.jsx` — user-scoped (intentional exception)
- `useAuth.jsx` — bootstraps before tenant context (intentional exception)
- `RecentActivity.jsx`, `GrowthIndices.jsx` — receive data as props, don't query directly

### Fix

**`src/components/users/UnitLeaderAssignments.jsx`:**
- Import `useTenantQuery`, use `scopeQuery` on SELECT, `withTenant` on INSERT, add tenant filter to DELETE, add `tenantId` to query keys

**`src/components/users/BulkUnitAssignDialog.jsx`:**
- Import `useTenantQuery`, scope all three queries by tenant, use `withTenant` on INSERT, add `tenantId` to query keys

**`src/components/certificates/IssueCertificateDialog.jsx`:**
- Scope the `training_types` app_settings query and `exam_titles` query with tenant filter, add `tenantId` to query keys

**`src/pages/PastoralCare.jsx`:**
- Scope the `pastoral-unit-members` query (unit_leader_assignments) with tenant filter, add `tenantId` to query key

**`src/pages/Followups.jsx`:**
- Scope the `followup-unit-members` query (unit_leader_assignments) with tenant filter, add `tenantId` to query key

### Files changed
- `src/components/users/UnitLeaderAssignments.jsx`
- `src/components/users/BulkUnitAssignDialog.jsx`
- `src/components/certificates/IssueCertificateDialog.jsx`
- `src/pages/PastoralCare.jsx`
- `src/pages/Followups.jsx`

