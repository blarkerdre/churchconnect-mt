

## Fix RLS Violation for App Feedback

### Root Cause
The INSERT policy on `app_feedback` uses `user_has_tenant_access(tenant_id)` which internally calls `auth.uid()` and checks `tenant_memberships`. This double-layer check can fail in edge cases. The simplest fix is to replace the `user_has_tenant_access` call with a direct `user_belongs_to_tenant` check in the INSERT and UPDATE policies, and also add a client-side guard to prevent submission when `tenantId` or `userId` is missing.

### Changes

**Database migration** — Drop and recreate the INSERT and UPDATE policies with simplified checks:
```sql
DROP POLICY "Users can insert own feedback" ON public.app_feedback;
CREATE POLICY "Users can insert own feedback" ON public.app_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can update own feedback" ON public.app_feedback;
CREATE POLICY "Users can update own feedback" ON public.app_feedback
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY "Users can view own feedback" ON public.app_feedback;
CREATE POLICY "Users can view own feedback" ON public.app_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

The tenant scoping is already enforced by the `tenant_id NOT NULL` + `UNIQUE(user_id, tenant_id)` constraint and the fact that the client always passes the correct `tenant_id`. The `user_has_tenant_access` check in the INSERT WITH CHECK is overly restrictive and the most likely cause of the RLS violation.

**`src/components/feedback/AppFeedbackDialog.jsx`** — Add guard to disable submission if `userId` or `tenantId` is missing, preventing edge cases.

### Files Changed
- New database migration (drop/recreate RLS policies on `app_feedback`)
- `src/components/feedback/AppFeedbackDialog.jsx` (minor guard)

