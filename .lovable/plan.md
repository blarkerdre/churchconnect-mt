

## Fix: Exam Management Tenant Scoping for Members

### Problem
The `MemberExamsView` component (non-admin exam view) has two issues:
1. **`withTenant` is not in scope** — line 951 calls `withTenant(...)` for course registration, but the component never calls `useTenantQuery()`. This causes a runtime error preventing course registration.
2. **Queries are not tenant-scoped** — the member's course registrations, subjects, and attempts queries don't filter by `tenant_id`, potentially showing cross-tenant data.

### Solution
Add `useTenantQuery()` to `MemberExamsView` and scope all queries with `tenant_id`.

### Changes — `src/pages/ExamManagement.jsx`

#### 1. Add tenant hook to MemberExamsView (after line 914)
```js
const { tenantId, scopeQuery, withTenant } = useTenantQuery();
```

#### 2. Scope registrations query (line 920)
Add `.eq("tenant_id", tenantId)` to the course_registrations query and add `tenantId` to the query key.

#### 3. Scope subjects query (line 929)
Add tenant scoping via `scopeQuery` and add `tenantId` to the query key.

#### 4. Scope attempts query (line 939)
Add `.eq("tenant_id", tenantId)` to exam_attempts query and add `tenantId` to the query key.

#### 5. Scope register mutation (line 951)
`withTenant` is now available — no change needed to the insert call itself.

### Files changed
- `src/pages/ExamManagement.jsx` — add tenant scoping to `MemberExamsView`

