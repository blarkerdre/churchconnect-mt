-- Storage usage RPCs and member-limit enforcement

-- 1) Compute live storage usage (in MB) for a tenant by walking storage.objects
--    using the established path conventions:
--      * tenant-branding / church-documents / book-covers : first folder = tenant_id
--      * profile-photos : first folder = user_id ; attribute to every tenant the
--        user is a member of (over-attributes when a user belongs to multiple
--        tenants, which errs on the safe side for quota enforcement)
CREATE OR REPLACE FUNCTION public.get_tenant_storage_usage_mb(_tenant_id uuid)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, storage
AS $$
  WITH tenant_member_users AS (
    SELECT DISTINCT user_id::text AS uid
    FROM public.members
    WHERE tenant_id = _tenant_id AND user_id IS NOT NULL
  ),
  sized AS (
    SELECT COALESCE((o.metadata->>'size')::bigint, 0) AS bytes
    FROM storage.objects o
    WHERE
      (
        o.bucket_id IN ('tenant-branding','church-documents','book-covers')
        AND (storage.foldername(o.name))[1] = _tenant_id::text
      )
      OR (
        o.bucket_id = 'profile-photos'
        AND (storage.foldername(o.name))[1] IN (SELECT uid FROM tenant_member_users)
      )
  )
  SELECT ROUND(COALESCE(SUM(bytes), 0)::numeric / (1024 * 1024), 2)
  FROM sized;
$$;

GRANT EXECUTE ON FUNCTION public.get_tenant_storage_usage_mb(uuid) TO authenticated, anon;

-- 2) Quota check helper. Returns true when the upload of _added_bytes would
--    keep the tenant under (or equal to) its storage_limit_mb. A 0/NULL limit
--    means unlimited.
CREATE OR REPLACE FUNCTION public.check_tenant_storage_quota(_tenant_id uuid, _added_bytes bigint DEFAULT 0)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit_mb integer;
  v_used_mb numeric;
  v_added_mb numeric;
BEGIN
  SELECT storage_limit_mb INTO v_limit_mb FROM public.tenants WHERE id = _tenant_id;
  IF v_limit_mb IS NULL OR v_limit_mb <= 0 THEN
    RETURN true; -- unlimited
  END IF;

  v_used_mb := public.get_tenant_storage_usage_mb(_tenant_id);
  v_added_mb := COALESCE(_added_bytes, 0)::numeric / (1024 * 1024);

  RETURN (v_used_mb + v_added_mb) <= v_limit_mb;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_tenant_storage_quota(uuid, bigint) TO authenticated, anon;

-- 3) Member limit enforcement trigger.
CREATE OR REPLACE FUNCTION public.enforce_member_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit integer;
  v_count integer;
BEGIN
  IF NEW.tenant_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT member_limit INTO v_limit FROM public.tenants WHERE id = NEW.tenant_id;
  IF v_limit IS NULL OR v_limit <= 0 THEN
    RETURN NEW; -- unlimited
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.members WHERE tenant_id = NEW.tenant_id;
  IF v_count >= v_limit THEN
    RAISE EXCEPTION 'MEMBER_LIMIT_REACHED: This church has reached its member limit (%). Please upgrade the plan or raise the limit in Tenant Admin.', v_limit
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS members_enforce_member_limit ON public.members;
CREATE TRIGGER members_enforce_member_limit
  BEFORE INSERT ON public.members
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_member_limit();