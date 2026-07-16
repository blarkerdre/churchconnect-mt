
ALTER TABLE public.wofbi_applications
  ADD COLUMN IF NOT EXISTS registration_origin text
  CHECK (registration_origin IN ('public_qr','member_self','admin'));

ALTER TABLE public.course_registrations
  ADD COLUMN IF NOT EXISTS registration_origin text
  CHECK (registration_origin IN ('public_qr','member_self','admin'));

COMMENT ON COLUMN public.wofbi_applications.registration_origin IS
  'Immutable origin of the application: public_qr (anon public form), member_self (signed-in member), admin (added by admin).';
COMMENT ON COLUMN public.course_registrations.registration_origin IS
  'Immutable origin of the registration: public_qr, member_self, or admin. Set at insert time; do not derive from members.user_id.';
