## Diagnosis (verified against the database)

`teen_checkin` (the RPC used by the roster's manual sign-in) authorises a non-guardian caller only if `is_admin(...)` OR `is_teens_unit_member(auth.uid(), tenant_id)` returns true. Otherwise it returns `not_authorised` and the toast just says "Failed" / the RPC error.

Both `is_teens_unit_leader` and `is_teens_unit_member` (defined in `supabase/migrations/20260717105516_...sql`) compare the unit name against a fixed whitelist:

```
('teens','teen','teenagers','youth','teens ministry','teen ministry')
```

A live query against `members.church_unit` in this project returns the actual unit name that has been in use:

```
teens church
```

`teens church` is not in the whitelist, so `is_teens_unit_member` returns false for every unit member (and `is_teens_unit_leader` returns false for anyone assigned to a `unit_leader_assignments` row named "Teens Church"). Result: they can open the page (nav gate is looser — regex `/teen|youth/i`) but the manual sign-in RPC rejects them.

The same mismatch exists in `src/hooks/useTeensUnitRole.jsx` (`TEENS_UNIT_NAMES`) and in the church-unit filter inside `src/components/AppLayout.jsx` for the sidebar.

## Fix

Add `'teens church'` and `'teen church'` to every Teens-unit whitelist so all four surfaces agree.

### SQL migration
Recreate both helpers with the expanded list (same signature, SECURITY DEFINER, `search_path = public`):

```
lower(btrim(x)) IN (
  'teens','teen','teenagers','youth',
  'teens ministry','teen ministry',
  'teens church','teen church'
)
```

- `public.is_teens_unit_leader(_user_id, _tenant_id)` — check against `unit_leader_assignments.unit_name`.
- `public.is_teens_unit_member(_user_id, _tenant_id)` — leader OR any comma-separated value in `members.church_unit` matches.

No policy or RPC body changes needed; every RLS policy and `teen_checkin` already delegate to these helpers.

### Frontend
- `src/hooks/useTeensUnitRole.jsx`: extend `TEENS_UNIT_NAMES` with `"teens church"` and `"teen church"` so the roster's "sign in" button and Teens Attendance page gates render for members.
- `src/components/AppLayout.jsx`: any Teens Attendance sidebar gate that uses a name list gets the same additions (the existing `/teen|youth/i` regex already covers "teens church", but I'll double-check the exact filter and align it with the hook).

## Verification

1. After the migration, run `SELECT public.is_teens_unit_member('<user_id>','<tenant_id>')` for a "teens church" member — expect `true`.
2. In the app, open a Teens session roster as that user and tap sign-in — expect a success toast and a new `teen_attendance_records` row with `source='worker'`.
3. Tap sign-in again on the same teen — expect the checked-out branch to fire.

## Out of scope

No changes to consent flow, notifications, session lifecycle, or the self-checkin RPC.
