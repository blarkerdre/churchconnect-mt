## Goal

Find out why clicking **Send exam link** for `mayodare@gmail.com` (approved 12:38 UTC, `exam_link_sent_at` still null, no `bible-school-exam-ready` row in `email_send_log`) is failing silently. Right now the function boots but produces zero application logs, so we can't tell whether it fails at `listUsers`, `createUser`, `generateLink`, or the `send-transactional-email` invoke.

## Change

Add structured logging (and slightly more defensive error surfacing) to `supabase/functions/provision-exam-account/index.ts` — no behaviour change, just observability.

Log lines to add (one `console.log` per checkpoint, prefixed with `[provision-exam-account]` and including `application_id`/`registration_id` + `emailLower` for correlation):

1. Entry: incoming body (`application_id`, `registration_id`, caller sub).
2. After loading the application/registration row: tenant_id, course_id, member_id, status.
3. After the admin check: role found.
4. After the `listUsers` loop: whether an existing user was matched, and how many pages scanned.
5. Around `admin.auth.admin.createUser`: log the attempt and, on error, log `createErr.message`, `createErr.status`, and `createErr.code` before returning.
6. After member ensure: memberId + whether it was created or matched.
7. Around `admin.auth.admin.generateLink`: log success (masked) or `linkErr.message`/`status`/`code`.
8. Around the `send-transactional-email` invoke: log the returned `status` and `invokeErr` details (already partly logged — expand to include the response body when available via `(invokeErr as any)?.context?.body`).
9. Final return: `email_sent`, `email_error`.

Also: when `createUser` fails, include its error in the JSON response (`{ error, code, status }`) so the client toast surfaces it too.

## Verify

1. Deploy the function.
2. In Exam Management, click **Send exam link** for mayodare.
3. Read edge-function logs for `provision-exam-account` and confirm we see the full breadcrumb trail and the exact failing step / GoTrue error message.
4. Fix the underlying cause in a follow-up once we know what it is (most likely a stale identity/FK from her recent auth-user delete, or a `send-transactional-email` rejection).

## Out of scope

- No change to the flow, auth checks, member linking, or email template.
- No change to `send-transactional-email` or `admin-delete-user`.
- Actual root-cause fix comes after we have the error message.
