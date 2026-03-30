

## Scope All Queries to Tenant

### Unscoped queries found

These are queries that access tenant-scoped tables but are missing `.eq("tenant_id", tenantId)` or `scopeQuery()`:

#### 1. Member lookups by `user_id` (missing tenant scope)
These all query `members` by `user_id` without tenant filtering. In a multi-tenant system, a user could have member records in multiple tenants.

| File | Line | Fix |
|------|------|-----|
| `src/pages/WSFManagement.jsx` | 17 | Add `.eq("tenant_id", tenantId)` and include `tenantId` in query key |
| `src/pages/PastoralCare.jsx` | 115 | Add `.eq("tenant_id", tenantId)` |
| `src/pages/Transportation.jsx` | 107 | Add `.eq("tenant_id", tenantId)` |
| `src/components/wsf/WSFAttendanceTab.jsx` | 33 | Add `.eq("tenant_id", tenantId)` and include `tenantId` in query key |

**Note:** `src/hooks/useAuth.jsx` (line 58) intentionally fetches cross-tenant — it resolves the current user's identity before a tenant context is available. No change needed there.

#### 2. `user_roles` delete missing tenant scope
Both locations delete roles without `.eq("tenant_id", tenantId)`, which could affect the same user's role in a different tenant.

| File | Line | Fix |
|------|------|-----|
| `src/components/members/MemberFormDialog.jsx` | 86 | Add `.eq("tenant_id", tenantId)` |
| `src/pages/UserManagement.jsx` | 100 | Add `.eq("tenant_id", tenantId)` |

#### 3. `followup_message_templates` delete missing tenant scope

| File | Line | Fix |
|------|------|-----|
| `src/components/settings/FollowupTemplatesSection.jsx` | 85 | Add `.eq("tenant_id", tenantId)` |

#### 4. `followup_message_templates` update missing tenant scope

| File | Line | Fix |
|------|------|-----|
| `src/components/settings/FollowupTemplatesSection.jsx` | 69-70 | Add `.eq("tenant_id", tenantId)` to update |

#### 5. `followup_message_templates` toggle missing tenant scope

| File | Line | Fix |
|------|------|-----|
| `src/components/settings/FollowupTemplatesSection.jsx` | 97-98 | Add `.eq("tenant_id", tenantId)` to toggle update |

### Files changed
- `src/pages/WSFManagement.jsx` — scope member lookup
- `src/pages/PastoralCare.jsx` — scope member lookup
- `src/pages/Transportation.jsx` — scope member lookup
- `src/pages/UserManagement.jsx` — scope role delete
- `src/components/wsf/WSFAttendanceTab.jsx` — scope member lookup
- `src/components/members/MemberFormDialog.jsx` — scope role delete
- `src/components/settings/FollowupTemplatesSection.jsx` — scope delete, update, and toggle mutations

### What stays unscoped (by design)
- `useAuth.jsx` — fetches user identity before tenant context exists
- `TenantContext.jsx` — manages tenant resolution itself
- `TenantAdmin.jsx` / `TenantBillingTab.jsx` — super-admin cross-tenant management
- `SystemLogs` / `AuditLog` — super-admin views (already documented as exceptions)

