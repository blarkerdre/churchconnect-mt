
-- app_feedback: require tenant access on insert
DROP POLICY IF EXISTS "Users can insert own feedback" ON public.app_feedback;
CREATE POLICY "Users can insert own feedback"
ON public.app_feedback
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
);

-- push_subscriptions: require tenant access on insert/select/update/delete
DROP POLICY IF EXISTS "Users can insert their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can view their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can update their own push subscriptions" ON public.push_subscriptions;
DROP POLICY IF EXISTS "Users can delete their own push subscriptions" ON public.push_subscriptions;

CREATE POLICY "Users can insert their own push subscriptions"
ON public.push_subscriptions
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
);

CREATE POLICY "Users can view their own push subscriptions"
ON public.push_subscriptions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id
  AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
);

CREATE POLICY "Users can update their own push subscriptions"
ON public.push_subscriptions
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id
  AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
)
WITH CHECK (
  auth.uid() = user_id
  AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
);

CREATE POLICY "Users can delete their own push subscriptions"
ON public.push_subscriptions
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id
  AND (tenant_id IS NULL OR public.user_has_tenant_access(tenant_id))
);
