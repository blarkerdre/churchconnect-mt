## Tenant Scoping Audit — Exam Sessions

### Findings

**RLS (server-side)** — solid:
- `exam_sessions`, `exam_session_courses`, `course_registrations`, `exam_attempts` all have admin-manage + member-view policies gated by `is_admin(auth.uid(), tenant_id)` / `user_has_tenant_access(tenant_id)`. Cross-tenant reads/writes are blocked even without client filters.

**Client-side (defense in depth)** — mostly correct, three gaps:

1. `SessionAggregateResults` (in `ExamSessionManager.jsx`, line ~389) queries `exam_attempts` by `session_id` only — no `tenant_id` filter and no tenantId in cache key. RLS blocks cross-tenant data, but the cache key can collide if a session id is reused after tenant switch (extremely unlikely with UUIDs, but still: cache hygiene).

2. `SessionEnrolDialog` query key `["session-existing-regs", session.id]` — same issue: missing `tenantId` in cache key.

3. `OpenSessionsPanel.registerMutation` and `SessionEnrolDialog.enrolMutation` — both correctly use `withTenant(...)` for inserts ✓. Filters on read queries all use `.eq("tenant_id", tenantId)` ✓.

**All other writes/reads verified correct:**
- `ExamSessionManager` mutations: every `update`/`delete` chains `.eq("tenant_id", tenantId)`, every `insert` uses `withTenant(...)`. ✓
- `OpenSessionsPanel` reads: scopeQuery / explicit tenant_id ✓
- `MyProfile` session-related queries: explicit tenant_id ✓

### Changes to make

**Edit `src/components/exams/ExamSessionManager.jsx`:**
- In `SessionAggregateResults`: add `tenantId` from `useTenantQuery`, add `.eq("tenant_id", tenantId)` to the `exam_attempts` query, include `tenantId` in the queryKey, and gate with `enabled: !!session.id && !!tenantId`.

**Edit `src/components/exams/SessionEnrolDialog.jsx`:**
- Add `tenantId` to the `["session-existing-regs", session.id]` query key (already filtered by tenant_id in the SQL).
- Add `tenantId` to the invalidation call after enrol.

No database migration needed — RLS already enforces isolation correctly.

### Out of scope

- No changes to server policies, no changes to schema.
- No behaviour changes for users; purely hardening cache keys and adding belt-and-braces tenant filter on one read.