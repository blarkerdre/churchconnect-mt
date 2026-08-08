CREATE INDEX IF NOT EXISTS idx_notifications_user_tenant_created ON public.notifications (user_id, tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_members_tenant_created ON public.members (tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_registrations_tenant_course_session ON public.course_registrations (tenant_id, course_id, session_id);