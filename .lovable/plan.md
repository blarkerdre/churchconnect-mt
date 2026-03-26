

## Fix: Tenant-Scope `has_role` and `is_admin` Functions + All Dependent RLS Policies

### Problem

`has_role(_user_id, _role)` and `is_admin(_user_id)` query `user_roles` and `tenant_memberships` **without filtering by tenant_id**. Any user with an elevated role in Tenant A passes these checks when accessing data in Tenant B, as long as `user_has_tenant_access` confirms basic membership. This is a cross-tenant privilege escalation affecting ~30 tables.

### Solution

**Step 1: Create tenant-aware function overloads**

Add new overloads that accept `_tenant_id uuid`:

```sql
-- has_role with tenant filter
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role AND tenant_id = _tenant_id
  )
$$;

-- is_admin with tenant filter
CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role IN ('admin', 'super_admin')
      AND (tenant_id = _tenant_id OR role = 'super_admin')
  )
  OR EXISTS (
    SELECT 1 FROM public.tenant_memberships
    WHERE user_id = _user_id AND tenant_id = _tenant_id
      AND role IN ('owner', 'admin')
  )
$$;
```

Note: `super_admin` in `user_roles` is intentionally **not** filtered by tenant — super admins are global. Regular `admin` roles and `tenant_memberships` are scoped.

**Step 2: Drop and recreate ALL RLS policies** that use `has_role(auth.uid(), ...)` or `is_admin(auth.uid())` to pass the row's `tenant_id`.

### Affected Tables (complete list from current schema)

Every policy using `is_admin(auth.uid())` or `has_role(auth.uid(), ...)`:

| Table | Policies to update |
|---|---|
| `announcements` | 2 policies |
| `app_settings` | 2 policies |
| `attendance_records` | 2 policies |
| `attendance_sessions` | 1 policy |
| `audit_log` | 2 policies |
| `books_of_the_month` | 1 policy |
| `certificate_templates` | 1 policy |
| `church_attendance_reports` | 2 policies |
| `church_units` | 1 policy |
| `course_registrations` | 1 policy |
| `documents` | 2 policies |
| `email_send_log` | 1 policy |
| `event_registrations` | 2 policies |
| `events` | 1 policy |
| `exam_answers` | 2 policies |
| `exam_attempts` | 2 policies |
| `exam_questions` | 1 policy |
| `exam_session_courses` | 1 policy |
| `exam_sessions` | 1 policy |
| `exam_titles` | 1 policy |
| `first_timers` | 2 policies |
| `followups` | 2 policies |
| `members` | 3 policies |
| `member_status_history` | 1 policy |
| `messages` | 0 (uses sender_id/recipient_id) |
| `notifications` | 1 policy |
| `pastoral_care` | 3 policies |
| `pickup_locations` | 1 policy |
| `sms_log` | 2 policies |
| `training_completions` | 1 policy (also missing tenant check) |
| `training_reports` | 1 policy (also missing tenant check) |
| `unit_leader_assignments` | 1 policy |
| `wsf_attendance` | ~2 policies |
| `wsf_attendance_reports` | 1 policy |
| `wsf_centres` | 1 policy |
| `profiles` | super_admin policies (keep global) |
| `tenant_memberships` | super_admin policies (keep global) |
| `storage.objects` | church-documents + book-covers policies |

### Pattern for each policy update

Before:
```sql
USING (is_admin(auth.uid()) AND user_has_tenant_access(tenant_id))
```

After:
```sql
USING (is_admin(auth.uid(), tenant_id))
```

Note: `user_has_tenant_access(tenant_id)` is **redundant** when `is_admin(auth.uid(), tenant_id)` already checks tenant membership, but we keep it for non-admin policies (e.g., member self-access).

For `has_role`:
```sql
-- Before
has_role(auth.uid(), 'unit_leader'::app_role) AND user_has_tenant_access(tenant_id)
-- After
has_role(auth.uid(), 'unit_leader'::app_role, tenant_id)
```

### Special cases

- **`super_admin` checks** (profiles, tenant_memberships, tenants): Keep using the **no-tenant** `has_role(auth.uid(), 'super_admin')` since super admins are global by design.
- **`training_completions` and `training_reports`**: Also add the missing `user_has_tenant_access(tenant_id)` guard (second security finding).
- **Storage policies** (church-documents, book-covers): These don't have a `tenant_id` column on `storage.objects`, so they'll continue using the global `is_admin`/`has_role` (storage is a shared concern).

### No application code changes needed

The frontend uses `useAuth()` which derives `isAdmin` from client-side state. RLS is the security boundary — the functions only change at the database level.

### Files Changed

- **One large database migration** — creates tenant-aware function overloads + drops/recreates ~45 RLS policies across ~30 tables

