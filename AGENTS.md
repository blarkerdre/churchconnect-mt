# AGENTS.md

- Any column that points a record at a person (assignee, leader, task owner) must have a BEFORE INSERT/UPDATE trigger checking that person belongs to the row's tenant (use `public.person_in_tenant` for user ids, `members.tenant_id` for member ids). Why: RLS alone doesn't stop an admin from linking another church's person, which leaks data via notifications.
- Account-wide admin actions (disable user, reset 2FA) by a non-super-admin must refuse targets who belong to any other tenant. Why: these actions affect every church the person is in.
- Settings that send member data to an admin-supplied URL (custom SMS/voice providers) may only be written by super-admins (DB trigger stamps `updated_by`), and edge functions must re-check `updated_by` is a super-admin before use. Why: prevents SSRF and data exfiltration by tenant admins.
