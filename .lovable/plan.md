# Narrow pastoral care and transport access to the right leaders

You said yes to tightening the three things spotted in the last security sweep.

## What changes for people

1. **Pastoral care cases** — only church admins, super admins and Pastoral Care unit leaders/members can see and manage cases. Other unit leaders lose access (the person a case is about, and whoever raised it, still see their own).
2. **Transport bookings** — only church admins, super admins, Transport unit leaders/members and the assigned driver can see and manage bookings. Other unit leaders lose access. Passengers still see and acknowledge their own bookings.
3. **No self-confirming transport** — even a Transport leader cannot confirm, assign or mark progress on a booking where they are the passenger; another transport staff member or an admin must do it.
4. **Automatic driver matching** — runs for every new booking, including ones members make themselves, not only leader-made ones.

## Steps

1. Read the current pastoral care and transport access rules, the transport guard, and the driver matching code to confirm exactly who is allowed today (diagnosis first; nothing assumed).
2. Add a helper "is transport staff" (admin, super admin, Transport unit leader/member) mirroring the existing "is pastoral staff" helper.
3. Replace the "any unit leader" checks in pastoral care and transport access rules with these helpers.
4. Extend the transport guard so staff cannot change status/assignment on their own booking.
5. Trigger driver matching after any new booking (server-side), keeping booking status Pending until staff confirm.
6. Update the pastoral and transport screens so leaders without access don't see empty/broken menus.
7. Test each rule in the test church with trial accounts (rolled back), then check the screens.

## Technical details

- New SECURITY DEFINER `is_transport_staff(_user_id, _tenant_id)` starting with `rpc_probe_blocked`.
- RLS on `pastoral_care` and `transportation`: swap `has_role(...,'unit_leader')` style clauses for `is_pastoral_staff` / `is_transport_staff`.
- `transportation_guard` (SECURITY INVOKER): if `NEW.member_id`/requester is the caller and caller is not admin/super_admin, block changes to status and assignment fields.
- Driver matching: call the existing matching function from an AFTER INSERT path or from the booking edge function for all callers.
- Update AGENTS.md rule on pastoral/transport staff.
