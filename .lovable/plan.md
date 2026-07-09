## What's happening

Two learners have already passed every subject of **Basic Certificate Course (BCC)** (Romoke 100% × 6/6, Loretta 70% × 6/6), yet:

- No `training_completions` row was created.
- Every BCC row in `exam_attempts` still has `certificate_issued = false`.
- No `certificate` email log entries for them.

The auto-issuance path is `grade-exam` → `checkCourseCompletion` → `fetch('/issue-certificate')` with `Authorization: Bearer <SERVICE_ROLE_KEY>`.

**The bug is in `issue-certificate`**: when called server-to-server with the service-role key, it still runs the "verify caller as a user" block:

```ts
const { data: claimsData } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
const userId = claimsData.claims.sub as string;   // undefined for service-role JWT
...
const { data: isAdminResult } = await supabase.rpc("is_admin", { _user_id: userId, _tenant_id });
if (!isAdminResult && !isTrainingRepLeader) return 403;
```

Service-role JWTs have no `sub` user id, so `is_admin` returns false and the function replies 403 "Only admins and the Training Rep unit leader can issue certificates". `grade-exam` swallows that in a `try/catch` and moves on, so exams look fine to the learner but no certificate is ever generated or emailed. This affects every multi-subject Bible School course (BCC, LCC, LDC) — not just BCC.

BFC completions still work because those are issued manually from the admin UI (real user JWT), which is why only BFC rows appear in `training_completions` and `email_send_log`.

## Fix (single file: `supabase/functions/issue-certificate/index.ts`)

1. At the top of the handler, detect a service-role call and bypass the user-role check:
   - Decode the JWT payload (base64url-decode the middle segment).
   - If `payload.role === 'service_role'`, treat the caller as trusted server-to-server: skip `getClaims`, skip `is_admin` / Training Rep checks, set `userId = null` (or a system marker) for audit purposes.
   - Otherwise keep the current user-verification + admin/Training-Rep logic exactly as it is.
2. Downstream code that uses `userId`:
   - `issued_by: userId` on insert/update → allow null (column is already nullable in practice; if not, fall back to `null` and note "system" in `writeAudit` details).
   - `writeAudit(...)` → pass `user_id: userId` (may be null) and add `source: 'grade-exam auto-issue'` to `details` when it's a service call so the audit trail is still clear.
3. No changes needed to `grade-exam`, `checkCourseCompletion`, `exam_titles`, or the BCC toggle. The `send_certificate_email = false` flag on BCC is a separate admin choice — once issuance works, admins can flip it on when they want the automatic email. The certificate PNG will still be generated and the `training_completions` row created either way, so learners can download from their profile.

## Verification

1. Deploy `issue-certificate`.
2. Have Romoke (or a test member) submit one more BCC subject attempt (or just re-run the last one) — `grade-exam` re-invokes `checkCourseCompletion` on every submit.
3. Confirm:
   - A `training_completions` row appears for the member with `training_type = 'Basic Certificate Course (BCC)'` and a real `certificate_url`.
   - `exam_attempts.certificate_issued` is not required to flip for the course-level path (that flag is only set on the single-exam path); the presence of the `training_completions` row is the source of truth.
   - `email_send_log`: no new BCC certificate row is expected while `send_certificate_email = false`. Turn the BCC toggle on and re-trigger to confirm the email enqueues and reaches `sent`.
4. No 403s in `issue-certificate` logs when called from `grade-exam`.

## Note on the BCC email toggle

I'm intentionally not flipping `send_certificate_email` on BCC in this fix — that's an admin preference. Once the underlying issuance works, you can toggle it on from the Bible School course settings whenever you want auto-emails to go out; existing already-eligible learners will get their certificate the next time they submit any BCC subject attempt.
