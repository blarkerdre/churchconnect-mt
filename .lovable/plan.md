
## Security Findings Triage

I'll present a focused plan to address each finding. Some require code/SQL changes; one is a false positive worth ignoring with justification.

### 1. `is_unit_leader_for_member_logic_flaw` — **FIX (high priority)**
Substring match means leader of unit "A" sees every member whose `church_unit` contains "a". Replace with exact, case-insensitive comparison against each comma-separated unit token.

**Migration**: Replace `is_unit_leader_for_member(_user_id, _church_unit, _tenant_id)`:
```sql
CREATE OR REPLACE FUNCTION public.is_unit_leader_for_member(_user_id uuid, _church_unit text, _tenant_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.unit_leader_assignments ula
    JOIN unnest(string_to_array(COALESCE(_church_unit, ''), ',')) AS token(unit) ON true
    WHERE ula.user_id = _user_id
      AND ula.tenant_id = _tenant_id
      AND lower(btrim(token.unit)) = lower(btrim(ula.unit_name))
  )
$$;
```
Same fix pattern for `is_unit_leader_for_session` if it shares the bug — verify during implementation.

### 2. `register_tenant_noauth` — **IGNORE (intentional public signup)**
The `register-tenant` endpoint is the **public church-onboarding wizard** at `/onboard`. By design, anyone can register a new church (tenant) just like signing up for SaaS. The "super_admin" role created is **scoped to the new tenant only** (`tenant_id = tenant.id`), not platform-wide super_admin. Platform super_admin requires `tenant_id IS NULL` and is unreachable here.

Mitigations already in place: slug uniqueness check, email confirm, Stripe billing gate. Will mark as ignored with this justification.

### 3. `user_roles_self_insert_escalation` — **FIX**
The current policy lets a user insert a role row matching a pending invitation but doesn't atomically consume the invitation. Fix: replace the self-insert policy with a SECURITY DEFINER RPC `accept_tenant_invitation(_invitation_id uuid)` that, in a single transaction, validates the invitation belongs to the caller's email + is pending, inserts the role + membership, and marks the invitation `accepted`. Then drop the permissive `Users can self-insert role via invitation` policy.

`TenantContext.acceptPendingInvitations` will switch to call the RPC instead of doing client-side inserts.

**Migration**:
```sql
CREATE OR REPLACE FUNCTION public.accept_tenant_invitation(_invitation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  inv record;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM auth.users WHERE id = auth.uid();
  IF user_email IS NULL THEN RAISE EXCEPTION 'unauthenticated'; END IF;

  SELECT * INTO inv FROM tenant_invitations
   WHERE id = _invitation_id AND status = 'pending'
     AND lower(email) = lower(user_email)
   FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'invitation not found or not pending'; END IF;

  INSERT INTO tenant_memberships (tenant_id, user_id, role)
  VALUES (inv.tenant_id, auth.uid(), COALESCE(inv.role, 'member'))
  ON CONFLICT (tenant_id, user_id) DO NOTHING;

  INSERT INTO user_roles (user_id, role, tenant_id)
  VALUES (auth.uid(), 'member', inv.tenant_id)
  ON CONFLICT DO NOTHING;

  UPDATE tenant_invitations SET status = 'accepted', accepted_at = now()
   WHERE id = inv.id;
END $$;

DROP POLICY IF EXISTS "Users can self-insert role via invitation" ON public.user_roles;
```

### 4. `grade_exam_answers_leak` — **FIX**
`supabase/functions/grade-exam/index.ts` returns `correct_answer` for each question in the response. Strip it: return only `{question_id, selected, is_correct, points}` per answer, plus aggregate score. Don't echo the correct value back.

### 5. `stripe_webhook_no_sig` — **FIX**
In `stripe-subscription-webhook/index.ts`, when `STRIPE_WEBHOOK_SECRET` is missing, currently the function falls back to parsing JSON without verification. Change to **reject (500)** when the secret is unset, so misconfiguration fails closed instead of accepting forged events.

### 6. `SUPA_public_bucket_allows_listing` — **NEEDS USER INPUT**
Likely the `tenant-branding` or `profile-photos` bucket. I need to identify which bucket(s) and whether listing must remain public (e.g., for landing page logos). Default fix: scope SELECT policy to specific path patterns (e.g., only allow `SELECT` on objects whose name matches `<tenant_slug>/logo.*`), not the whole bucket. Will inspect storage policies during implementation and propose per-bucket fixes.

### 7. `exam_questions_correct_answers_exposed` — **FIX**
Add a RESTRICTIVE SELECT policy denying non-admin/non-leader access, AND additionally remove `correct_answer`, `option_a..d` correctness markers from any member-facing query path. Members already use `take-exam` flows — verify they don't `select("*")` from `exam_questions`. Safe layered fix:

```sql
CREATE POLICY "Restrict correct answer reads to staff" ON public.exam_questions
AS RESTRICTIVE FOR SELECT TO authenticated
USING (is_admin(auth.uid(), tenant_id) OR has_role(auth.uid(), 'unit_leader'::app_role, tenant_id));
```
Then audit `TakeExamDialog.jsx` to use a SECURITY DEFINER function `get_exam_questions_for_attempt(...)` that returns rows without `correct_answer`. Will inspect that file during implementation.

## Files / Migrations
- **Migration 1**: fix `is_unit_leader_for_member` (and sibling session function if affected).
- **Migration 2**: `accept_tenant_invitation` RPC + drop permissive policy.
- **Migration 3**: RESTRICTIVE policy on `exam_questions` + `get_exam_questions_for_attempt` RPC.
- **Migration 4** (after inspection): tighten storage SELECT policies on the offending public bucket.
- **Edit**: `supabase/functions/grade-exam/index.ts` — strip `correct_answer` from response.
- **Edit**: `supabase/functions/stripe-subscription-webhook/index.ts` — fail closed when secret missing.
- **Edit**: `src/contexts/TenantContext.jsx` — call new RPC instead of client-side invitation insert.
- **Edit**: `src/components/exams/TakeExamDialog.jsx` — switch question fetch to RPC (if needed).
- **Mark ignored**: `register_tenant_noauth` with justification (public onboarding by design, tenant-scoped role).

No UI changes required beyond TakeExamDialog and the silent invitation flow. After approval I'll inspect the storage buckets and TakeExamDialog to finalise the last two fixes, then apply everything in one pass.
