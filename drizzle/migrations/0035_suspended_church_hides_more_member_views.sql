CREATE POLICY "Suspended tenants restrict home cell attendance" ON public.wsf_attendance AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.tenant_is_suspended(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Suspended tenants restrict teen attendance" ON public.teen_attendance_records AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.tenant_is_suspended(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Suspended tenants restrict preteen attendance" ON public.preteen_attendance_records AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.tenant_is_suspended(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Suspended tenants restrict bible school attendance" ON public.wofbi_attendance_records AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.tenant_is_suspended(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Suspended tenants restrict events" ON public.events AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.tenant_is_suspended(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));

CREATE POLICY "Suspended tenants restrict announcements" ON public.announcements AS RESTRICTIVE FOR SELECT TO authenticated
USING (NOT public.tenant_is_suspended(tenant_id) OR public.is_admin(auth.uid(), tenant_id) OR public.has_role(auth.uid(), 'super_admin'::public.app_role));