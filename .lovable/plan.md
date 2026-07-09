# Fix: "Retake exam says admin(uuid) does not exist"

## Root cause

Any UPDATE on `public.exam_attempts` fires the `trg_protect_exam_attempt_fields` trigger, which runs:

```sql
SELECT public.is_admin(auth.uid()) INTO _is_admin;
```

But the only `is_admin` function defined in the database is `is_admin(_user_id uuid, _tenant_id uuid)`. Postgres can't resolve the single-argument call and raises `function is_admin(uuid) does not exist` (surfaced in the UI as "admin(uuid) does not exist").

This breaks the admin "Allow Retake" button in `CourseResultsView` (it sets `retake_allowed = true` on the latest failed attempt) and any other UPDATE path on exam_attempts run by non-service-role clients.

## Plan

Add a migration that replaces `public.protect_exam_attempt_fields()` so it calls the tenant-scoped signature using the row's tenant:

```sql
SELECT public.is_admin(auth.uid(), NEW.tenant_id) INTO _is_admin;
```

Everything else in the function (service_role bypass, sensitive-field guard on score/passed/certificate_issued/total_points) stays identical. Trigger definition itself is untouched — only the function body changes.

## Verification

1. As an admin, click "Retake {subject}" on a failed attempt in Course Results → toast "Retake allowed for this member" appears, no error.
2. As a regular member, attempting to update `score`/`passed`/`total_points`/`certificate_issued` still raises "You are not allowed to modify exam results".
3. No code, RLS policy, or frontend changes required.
