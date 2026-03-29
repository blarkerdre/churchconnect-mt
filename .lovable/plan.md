

## Deep Audit: Components Missing Tenant Scoping

### Findings

After reviewing all 48+ files with Supabase queries, here are the components/features that are **NOT properly tenant-scoped**:

---

### 1. WSFLeaderDashboard — 3 unscoped queries
**File:** `src/components/dashboard/WSFLeaderDashboard.jsx`
- `wsf_centres` query (line 25) — no `scopeQuery` or `tenantId` filter
- `members` query (line 42) — no tenant filter, only filters by `wsf_centre_id`
- `wsf_attendance_reports` query (line 58) — no tenant filter
- **Query keys** also missing `tenantId`

**Fix:** Import `useTenantQuery`, add `scopeQuery` to all three queries, add `tenantId` to query keys.

---

### 2. BulkImportDialog — unscoped email lookup
**File:** `src/components/members/BulkImportDialog.jsx`
- Line 117: `supabase.from("members").select("id, email").in("email", emails)` — no tenant scope
- This could match members from **other tenants** with the same email, causing cross-tenant updates

**Fix:** Add `scopeQuery` wrapper or `.eq("tenant_id", tenantId)` to the email lookup query.

---

### 3. SelfCheckInWidget — unscoped member lookup
**File:** `src/components/attendance/SelfCheckInWidget.jsx`
- Line 23: `supabase.from("members").select(...).eq("user_id", user.id).maybeSingle()` — no tenant scope
- Could return a member from a different tenant if user belongs to multiple tenants
- **Query key** missing `tenantId`

**Fix:** Add `.eq("tenant_id", tenantId)` and include `tenantId` in query key.

---

### 4. MemberJourneyTimeline — no tenant scoping
**File:** `src/components/members/MemberJourneyTimeline.jsx`
- Line 20: `supabase.from("member_status_history").select("*").eq("member_id", memberId)` — no tenant filter
- Low risk since `member_id` is already specific, but not following the pattern

**Fix:** Import `useTenantQuery`, add `tenantId` to query key for cache isolation.

---

### 5. MyCertificates — no tenant scoping
**File:** `src/components/certificates/MyCertificates.jsx`
- Line 15: `supabase.from("training_completions").select("*").eq("member_id", memberId)` — no tenant filter
- Similar low risk but missing cache isolation

**Fix:** Import `useTenantQuery`, add `tenantId` to query key.

---

### 6. NotificationBell — missing cache isolation
**File:** `src/components/notifications/NotificationBell.jsx`
- Intentionally user-scoped (per architecture docs), but query key `["notifications", user?.id]` lacks `tenantId`
- Could show stale notifications from another tenant after switching

**Fix:** Add `tenantId` to query key for cache isolation: `["notifications", user?.id, tenantId]`

---

### 7. MessagingPane — missing tenant filter on read
**File:** `src/components/comms/MessagingPane.jsx`
- Line 24: Messages query only filters by `sender_id`/`recipient_id`, no tenant scope
- Insert uses `withTenant` (good), but reads could show messages from other tenant contexts
- **Query key** missing `tenantId`

**Fix:** Add `scopeQuery` to the messages read query and `tenantId` to query key.

---

### 8. useAuth hook — member lookup not tenant-scoped
**File:** `src/hooks/useAuth.jsx`
- Line 57: `supabase.from("members").select(...).eq("user_id", userId).maybeSingle()` — no tenant filter
- Could return member from wrong tenant for multi-tenant users
- This is an intentional bootstrap exception per architecture docs, but worth noting

**Risk:** Medium — affects `myMember` which is used across the app.

---

### Summary of Changes

| # | File | Issue | Risk |
|---|------|-------|------|
| 1 | WSFLeaderDashboard | 3 queries missing scopeQuery + tenantId in keys | **High** |
| 2 | BulkImportDialog | Email lookup crosses tenants | **High** |
| 3 | SelfCheckInWidget | Member lookup missing tenant filter | **Medium** |
| 4 | MemberJourneyTimeline | Missing tenantId in query key | **Low** |
| 5 | MyCertificates | Missing tenantId in query key | **Low** |
| 6 | NotificationBell | Missing tenantId in query key | **Low** |
| 7 | MessagingPane | Read query not tenant-scoped | **Medium** |
| 8 | useAuth | myMember not tenant-scoped (bootstrap exception) | **Medium** |

### Implementation
- Fix all 8 files in a single pass
- No database migrations needed — these are all client-side query fixes
- Add `useTenantQuery` import where missing
- Add `scopeQuery` wrapper to unscoped queries
- Add `tenantId` to all query keys for cache isolation

