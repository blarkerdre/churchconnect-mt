# Plan: Auto-create member on Bible School application approval

Enable non-member applicants (registered via the public Bible School application form) to use the attendance check-in after approval.

## Approach

When an admin approves a `wofbi_applications` row, ensure a `members` row exists in the same tenant for that applicant. This satisfies the `wofbi_checkin` RPC's `not_a_member` gate without changing the RPC.

## Changes

1. **Migration – trigger on `wofbi_applications` approval**
   - Create a `SECURITY DEFINER` function `ensure_member_for_wofbi_application()` that runs `AFTER UPDATE` when `status` transitions to `approved` (and `AFTER INSERT` when status is already `approved`).
   - Logic:
     - If `application.member_id` is set and that member exists in the same tenant → no-op.
     - Else, look up an existing `members` row in the tenant by `email` (case-insensitive). If found, link it back onto the application (`member_id`).
     - Else, insert a new `members` row with: `first_name`, `last_name`, `email`, `phone`, `tenant_id`, `membership_status = 'Bible School'`, `gdpr_consent = true`, `gdpr_consent_date = now()`. Save the new id onto `application.member_id`.
   - Attach the trigger to `wofbi_applications`.
   - `search_path = public` on the function.

2. **Course registration linkage**
   - On approval, also ensure a `course_registrations` row exists for `(tenant_id, course_id, member_id)` with an approved status (existing approval flow likely already does this; only add if missing to keep the second RPC gate satisfied).

3. **Backfill**
   - One-time SQL inside the same migration: for every `wofbi_applications` row already `approved` without a valid `member_id`, run the same ensure-member logic so existing approved applicants can check in immediately.

## Not changing

- `wofbi_checkin` RPC (gates remain).
- The public registration Edge Function (already creates a member on submission in most paths; the trigger just covers gaps and pre-existing rows).
- Attendance UI.

## Notes

- No auth user is created here — a member row without `user_id` is enough for the RPC's member check when it matches by `member_id`. If the RPC strictly requires `user_id` match, I'll adjust by matching on email/member link. I'll verify the RPC's exact member lookup before writing the migration and adapt if needed.
