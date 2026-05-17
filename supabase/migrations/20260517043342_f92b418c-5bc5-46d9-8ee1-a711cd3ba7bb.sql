
-- 1) Restrict members' UPDATE on exam_attempts to their tenant
DROP POLICY IF EXISTS "Members can update own exam attempts (restricted)" ON public.exam_attempts;
CREATE POLICY "Members can update own exam attempts (restricted)"
ON public.exam_attempts
FOR UPDATE
TO authenticated
USING (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  AND public.user_has_tenant_access(tenant_id)
)
WITH CHECK (
  member_id IN (SELECT id FROM public.members WHERE user_id = auth.uid())
  AND public.user_has_tenant_access(tenant_id)
);

-- 2) Lock down jsonb_diff search_path
CREATE OR REPLACE FUNCTION public.jsonb_diff(_old jsonb, _new jsonb, _ignore text[] DEFAULT ARRAY['updated_at'::text, 'created_at'::text])
 RETURNS jsonb
 LANGUAGE plpgsql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
DECLARE k text; v jsonb; before_j jsonb := '{}'::jsonb; after_j jsonb := '{}'::jsonb;
BEGIN
  IF _new IS NULL THEN RETURN jsonb_build_object('before', _old, 'after', null); END IF;
  IF _old IS NULL THEN RETURN jsonb_build_object('before', null, 'after', _new); END IF;
  FOR k, v IN SELECT * FROM jsonb_each(_new) LOOP
    IF k = ANY(_ignore) THEN CONTINUE; END IF;
    IF (_old->k) IS DISTINCT FROM v THEN
      before_j := before_j || jsonb_build_object(k, _old->k);
      after_j := after_j || jsonb_build_object(k, v);
    END IF;
  END LOOP;
  IF after_j = '{}'::jsonb THEN RETURN NULL; END IF;
  RETURN jsonb_build_object('before', before_j, 'after', after_j);
END;
$function$;
