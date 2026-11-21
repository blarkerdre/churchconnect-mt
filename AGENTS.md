# AGENTS.md

- Any column that points a record at a person (assignee, leader, task owner) must have a BEFORE INSERT/UPDATE trigger checking that person belongs to the row's tenant (use `public.person_in_tenant` for user ids, `members.tenant_id` for member ids). Why: RLS alone doesn't stop an admin from linking another church's person, which leaks data via notifications.
- Account-wide admin actions (disable user, reset 2FA) by a non-super-admin must refuse targets who belong to any other tenant. Why: these actions affect every church the person is in.
- Settings that send member data to an admin-supplied URL (custom SMS/voice providers) may only be written by super-admins (DB trigger stamps `updated_by`), and edge functions must re-check `updated_by` is a super-admin before use. Why: prevents SSRF and data exfiltration by tenant admins.
- Any SECURITY DEFINER permission helper that takes a `_user_id` must begin with `public.rpc_probe_blocked('<fn_name>', _user_id)` and return false/0 when it's true. Why: stops signed-in users calling the helper directly to learn other people's roles, while RLS policies and triggers can still check other people.
- Edge functions that send assignment notices (text/email/bell) must skip repeats via `_shared/notice-dedupe.ts`. Why: re-assigning a record must not let someone spam the assignee.
