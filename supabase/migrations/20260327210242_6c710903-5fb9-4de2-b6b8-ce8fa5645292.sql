-- Recreate the trigger for automatic profile creation on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Backfill missing profiles for existing auth users
INSERT INTO public.profiles (user_id, full_name, email)
SELECT u.id, COALESCE(u.raw_user_meta_data->>'full_name', u.email), u.email
FROM auth.users u
WHERE NOT EXISTS (
  SELECT 1 FROM public.profiles p WHERE p.user_id = u.id
)
ON CONFLICT (user_id) DO NOTHING;

-- Set tenant_id on backfilled profiles from tenant_memberships
UPDATE public.profiles p
SET tenant_id = (
  SELECT tm.tenant_id FROM public.tenant_memberships tm
  WHERE tm.user_id = p.user_id LIMIT 1
)
WHERE p.tenant_id IS NULL
  AND EXISTS (SELECT 1 FROM public.tenant_memberships tm WHERE tm.user_id = p.user_id);