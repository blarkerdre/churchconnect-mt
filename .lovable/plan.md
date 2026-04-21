

## Why Favour sees "Unknown" on her Follow-up list

### Root cause (RLS, not a UI bug)
Favour Igbineweka has the `unit_leader` role for "Follow-Up". As a unit leader, she can read **every** follow-up in the tenant (16 in total). But for the 9 follow-ups that are **not assigned to her**, the `members(...)` join in the query is filtered out by Row Level Security and returns `null` — so the page falls back to the literal string `"Unknown"` (`src/pages/Followups.jsx` line 112).

The members in question are first-timers / visitors with an **empty `church_unit`**, so the existing `members` SELECT policies all miss for her on those rows:

| Policy | Result for Favour on a non-her followup's member |
|---|---|
| Admins can view all members | ✗ not admin |
| Unit leaders can view unit members | ✗ member's `church_unit` is empty, no match against "Follow-Up" |
| WSF leaders can view centre members | ✗ no centre |
| Assigned followup users can view followup member | ✗ only fires when she IS the assignee |
| Assigned referral leaders can view referred member | ✗ no referral to her |

Net effect: she sees the follow-up row, but the embedded member is invisible → "Unknown".

Confirmed in DB: 16 follow-ups in the Cardiff tenant, 7 assigned to her (those show the correct name), 9 not assigned to her (those show "Unknown").

### Fix — add one RLS policy on `public.members`

Allow a user who can already read a `followups` row to also read the member it points to. This mirrors the existing follow-ups visibility rule and exposes nothing she can't already see by name in other places (the dashboard widgets, the analytics export, etc.).

```sql
CREATE POLICY "Followup viewers can view followup member"
ON public.members
FOR SELECT
TO authenticated
USING (
  user_has_tenant_access(tenant_id)
  AND EXISTS (
    SELECT 1
    FROM public.followups f
    WHERE f.member_id = members.id
      AND f.tenant_id = members.tenant_id
      AND (
        is_admin(auth.uid(), f.tenant_id)
        OR has_role(auth.uid(), 'unit_leader'::app_role, f.tenant_id)
        OR has_role(auth.uid(), 'wsf_leader'::app_role, f.tenant_id)
      )
  )
);
```

The narrower "Assigned followup users can view followup member" stays in place so members assigned to non-leader users keep working.

### Why this is safe
- It only widens visibility on members **already referenced by a follow-up the user can read** — a follow-up they were going to act on anyway.
- It still requires `user_has_tenant_access`, so it's tenant-scoped.
- It does not let unit leaders read every member in the tenant (the existing `church_unit` rule still governs that).

### No code changes needed
`src/pages/Followups.jsx`, `FollowupDetailPanel`, `OverdueReminder` and the dashboard widgets all use the same embed. Once the policy is added, they will start showing real names automatically.

### Verification
1. Sign in as Favour.
2. Open **Follow-ups** → every row now shows a real member name; no more "Unknown".
3. Open one of the previously-broken rows → Detail panel shows phone, email, status.
4. Sign in as a regular member with no leader role → they still see only their own follow-ups (no widening).
5. Sign in as a unit leader in a **different** tenant → they cannot see Cardiff members (tenant guard intact).

