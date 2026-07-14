# Fix: Exam link email not delivered

## What's happening

When an admin clicks "Send exam link", `provision-exam-account` provisions the user/member/registration and then invokes `send-transactional-email` to email the magic link. That inner invoke is now returning **401 Unauthorized**, and because `provision-exam-account` wraps it in a try/catch that only logs, the outer request still returns `{ ok: true }` — so the UI shows success while no email is queued. Recent `email_send_log` has no `bible-school-exam-ready` rows today, confirming the send never enqueued.

The 401 was introduced by the earlier `open_send_transactional_email` security fix, which requires the caller to present either the service-role key or a valid signed-in user JWT. The `admin.functions.invoke(...)` call inside `provision-exam-account` is not reliably presenting the service-role key as `Authorization: Bearer …`, so it's rejected.

## Fix

Update `supabase/functions/provision-exam-account/index.ts` so the invocation of `send-transactional-email` explicitly forwards a valid bearer token, and surface (not swallow) the error so future regressions are visible:

1. Pass an explicit `Authorization` header to `admin.functions.invoke("send-transactional-email", ...)` using the service-role key from `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`. This matches the "service role" branch of `send-transactional-email`'s in-code auth check.
2. If the invoke returns an error, include a warning field (e.g. `email_sent: false`, `email_error: <message>`) in the response so the UI/admin can see when the email didn't go out — but still return the magic link so the admin can share it manually as a fallback. Do not throw; provisioning success shouldn't be undone by an email hiccup.
3. Redeploy `provision-exam-account`.

No other functions, templates, or DB changes are needed. `send-transactional-email` itself stays as-is — its stricter auth is correct and required for the security finding.

## Verification

- Trigger "Send exam link" from Bible School applications.
- Confirm a new `bible-school-exam-ready` row appears in `email_send_log` with `status: sent`.
- Confirm the recipient receives the magic-link email.
- Confirm `provision-exam-account` logs no `send-transactional-email failed` entry.

## Out of scope

- No changes to `send-transactional-email`'s auth logic.
- No changes to the email template or the magic-link generation.
- No changes to any other caller of `send-transactional-email` (they either run in the browser with a user JWT — which the auth check already accepts — or should be audited separately if 401s appear).
