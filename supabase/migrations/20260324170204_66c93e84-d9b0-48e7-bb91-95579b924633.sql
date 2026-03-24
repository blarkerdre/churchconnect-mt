
-- Batch D: Config/misc tables

ALTER TABLE public.app_settings ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_app_settings_tenant_id ON public.app_settings(tenant_id);

ALTER TABLE public.church_units ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_church_units_tenant_id ON public.church_units(tenant_id);

ALTER TABLE public.wsf_centres ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_wsf_centres_tenant_id ON public.wsf_centres(tenant_id);

ALTER TABLE public.wsf_attendance ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_wsf_attendance_tenant_id ON public.wsf_attendance(tenant_id);

ALTER TABLE public.wsf_attendance_reports ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_wsf_attendance_reports_tenant_id ON public.wsf_attendance_reports(tenant_id);

ALTER TABLE public.pickup_locations ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_pickup_locations_tenant_id ON public.pickup_locations(tenant_id);

ALTER TABLE public.transportation ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_transportation_tenant_id ON public.transportation(tenant_id);

ALTER TABLE public.books_of_the_month ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_books_of_the_month_tenant_id ON public.books_of_the_month(tenant_id);

ALTER TABLE public.documents ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_documents_tenant_id ON public.documents(tenant_id);

ALTER TABLE public.first_timers ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_first_timers_tenant_id ON public.first_timers(tenant_id);

ALTER TABLE public.audit_log ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_audit_log_tenant_id ON public.audit_log(tenant_id);

ALTER TABLE public.email_send_log ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_email_send_log_tenant_id ON public.email_send_log(tenant_id);

ALTER TABLE public.training_reports ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_training_reports_tenant_id ON public.training_reports(tenant_id);

ALTER TABLE public.training_completions ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_training_completions_tenant_id ON public.training_completions(tenant_id);

ALTER TABLE public.member_status_history ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_member_status_history_tenant_id ON public.member_status_history(tenant_id);

ALTER TABLE public.sms_log ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_sms_log_tenant_id ON public.sms_log(tenant_id);

ALTER TABLE public.unit_leader_assignments ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_unit_leader_assignments_tenant_id ON public.unit_leader_assignments(tenant_id);

ALTER TABLE public.suppressed_emails ADD COLUMN tenant_id uuid REFERENCES public.tenants(id);
CREATE INDEX idx_suppressed_emails_tenant_id ON public.suppressed_emails(tenant_id);

-- Backfill all
UPDATE public.app_settings SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.church_units SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.wsf_centres SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.wsf_attendance SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.wsf_attendance_reports SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.pickup_locations SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.transportation SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.books_of_the_month SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.documents SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.first_timers SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.audit_log SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.email_send_log SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.training_reports SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.training_completions SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.member_status_history SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.sms_log SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.unit_leader_assignments SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
UPDATE public.suppressed_emails SET tenant_id = 'a0000000-0000-0000-0000-000000000001' WHERE tenant_id IS NULL;
