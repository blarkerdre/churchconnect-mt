
-- Batch B: Operations tables

-- attendance_sessions
ALTER TABLE public.attendance_sessions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_attendance_sessions_tenant_id ON public.attendance_sessions(tenant_id);

-- attendance_records
ALTER TABLE public.attendance_records ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_attendance_records_tenant_id ON public.attendance_records(tenant_id);

-- church_attendance_reports
ALTER TABLE public.church_attendance_reports ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_church_attendance_reports_tenant_id ON public.church_attendance_reports(tenant_id);

-- events
ALTER TABLE public.events ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_events_tenant_id ON public.events(tenant_id);

-- event_registrations
ALTER TABLE public.event_registrations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_event_registrations_tenant_id ON public.event_registrations(tenant_id);

-- announcements
ALTER TABLE public.announcements ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_announcements_tenant_id ON public.announcements(tenant_id);

-- Backfill all with default tenant
UPDATE public.attendance_sessions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.attendance_records SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.church_attendance_reports SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.events SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.event_registrations SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.announcements SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
