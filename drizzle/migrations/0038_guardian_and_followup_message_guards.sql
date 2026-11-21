-- 1. Only church admins may change who a child's main parent is (or move a child to another church).
CREATE OR REPLACE FUNCTION public.children_guard_primary_guardian()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.primary_guardian_member_id IS DISTINCT FROM OLD.primary_guardian_member_id
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id THEN
    IF NOT (public.is_admin(auth.uid(), OLD.tenant_id) OR public.has_role(auth.uid(), 'super_admin'::app_role)) THEN
      RAISE EXCEPTION 'Only church admins can change a child''s main parent' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.children_guard_primary_guardian() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_children_guard_primary_guardian ON public.children;
CREATE TRIGGER trg_children_guard_primary_guardian
BEFORE UPDATE OF primary_guardian_member_id, tenant_id ON public.children
FOR EACH ROW EXECUTE FUNCTION public.children_guard_primary_guardian();

-- 2. Only the main parent (or a church admin) may add or change authorised pickup adults.
--    Other authorised adults can still see the list and remove themselves.
DROP POLICY IF EXISTS "Child guardians manage" ON public.child_guardians;

CREATE POLICY "Child guardians insert by main parent or admin"
ON public.child_guardians FOR INSERT TO authenticated
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
);

CREATE POLICY "Child guardians update by main parent or admin"
ON public.child_guardians FOR UPDATE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
)
WITH CHECK (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
);

CREATE POLICY "Child guardians delete by main parent, admin or self"
ON public.child_guardians FOR DELETE TO authenticated
USING (
  public.is_admin(auth.uid(), tenant_id)
  OR public.is_child_primary_guardian(auth.uid(), child_id, tenant_id)
  OR EXISTS (
    SELECT 1 FROM public.members m
    WHERE m.id = child_guardians.member_id
      AND m.user_id = auth.uid()
      AND m.tenant_id = child_guardians.tenant_id
  )
);

-- 3. Scheduled follow-up messages always record their real author, so content
--    rules are applied by the author's role when they are sent.
CREATE OR REPLACE FUNCTION public.followup_message_stamp_author()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := auth.uid();
  ELSE
    NEW.created_by := OLD.created_by;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.followup_message_stamp_author() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_followup_message_stamp_author ON public.followup_scheduled_messages;
CREATE TRIGGER trg_followup_message_stamp_author
BEFORE INSERT OR UPDATE ON public.followup_scheduled_messages
FOR EACH ROW EXECUTE FUNCTION public.followup_message_stamp_author();