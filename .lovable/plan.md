## Problem

Favour Igbineweka is a member of the **Follow-Up** church unit (so the app correctly shows her the *Refer to Leader* button on First Timer / New Convert / Visitor follow-ups), but when she actually tries to sign-post:

- **Unit Leader path** — after she picks a church unit, the "Leader to assign" dropdown shows *"No leaders assigned"* even though leaders exist.
- **Home Cell path** — after she picks a centre, she gets *"Centre leader is not linked to a user account"* and the submit is blocked.

So the dialog opens, but every selection dead-ends.

## Root cause (database RLS)

The SignPost dialog (`src/components/followups/SignPostDialog.jsx`) makes two lookups that hit RLS that doesn't include Follow-up team members:

1. **`unit_leader_assignments` SELECT** — current policies:
   - `Admins can manage unit leader assignments` (admins only)
   - `Users can view own assignments` (`auth.uid() = user_id`)
   
   So Favour can only see *her own* assignment row. The unit-leader dropdown query returns an empty list for any unit other than ones she leads → "No leaders assigned".

2. **`members` SELECT for centre leader** — the dialog reads `members.user_id` for `centre.leader_id`. None of the existing `members` SELECT policies match a Follow-up team member looking up an arbitrary centre leader, so the row returns `null` → "Centre leader is not linked to a user account".

(The `followup_referrals` INSERT policy itself is fine — `is_followup_team_member` already covers Favour.)

## Fix — database migration only

Add two narrowly-scoped SELECT policies. No code changes.

### Migration

```sql
-- Allow Follow-up team to see all unit leader assignments in their tenant,
-- so they can pick a leader to sign-post to.
CREATE POLICY "Followup team can view unit leader assignments"
ON public.unit_leader_assignments
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND is_followup_team_member(auth.uid(), tenant_id)
);

-- Allow Follow-up team to see ONLY members who are designated home-cell centre
-- leaders (not the whole directory), so the centre-leader lookup works.
CREATE POLICY "Followup team can view centre leader members"
ON public.members
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND is_followup_team_member(auth.uid(), tenant_id)
  AND EXISTS (
    SELECT 1 FROM public.wsf_centres c
    WHERE c.tenant_id = members.tenant_id
      AND c.leader_id = members.id
  )
);
```

Both policies are additive (RLS is permissive), so existing access is unchanged. The `members` policy is intentionally narrow — it exposes only members who are listed as a centre leader, not the rest of the directory.

## Out of scope

- No changes to `SignPostDialog.jsx`, `FollowupDetailPanel.jsx`, or `Followups.jsx`.
- No change to who can see the **Refer to Leader** button (already correct).
- No change to `followup_referrals` policies.
- The broader question of "should every Follow-up team member also see all unit-leader contact info elsewhere in the app?" — left as-is.

## Verification

Sign in as Favour:

1. Open a First Timer follow-up → click **Refer to Leader**.
2. **Unit Leader** tab → pick any unit → "Leader to assign" lists real leaders (not empty).
3. **Home Cell** tab → centre auto-suggested → submit → toast "Sign-posted", referral row inserted, leader notified.
4. Repeat as a normal `member` (not Follow-up unit) → still gets the existing empty-state messages (policies require `is_followup_team_member`).
