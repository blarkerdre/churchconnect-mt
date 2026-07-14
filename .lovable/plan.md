## Goal
Stop the "success toast but no email arrives" bug for **Send exam link** in Bible School → Exam Management. Today the UI reports success even when the inner email send fails silently.

## Root cause (confirmed so far)
- `provision-exam-account` returns `{ ok: true, magic_link, email_sent, email_error }`.
- `email_sent` can be `false` (invoke of `send-transactional-email` failed), but the client (`src/pages/ExamManagement.jsx` → `sendOne` / `sendExamLinkMutation`) only checks `data.error` and `error`. It does NOT read `email_sent` / `email_error`, so failures show as a green "Exam link sent" toast.
- The most recent successful `bible-school-exam-ready` send in `email_send_log` is 12:31:36 UTC. Any attempts after that produced no `email_send_log` row and no HTTP call log — but the admin still saw a success toast. That is the silent-failure path.

## Changes

### 1. Client — honestly report per-registration email status
File: `src/pages/ExamManagement.jsx`

- In `sendOne`, after a non-error response, inspect `data.email_sent`:
  - `true` → mark as sent (current success path).
  - `false` → return `{ ok: false, registrationId, error: new Error(data.email_error || "Email failed to send"), magic_link: data.magic_link }`.
- In `sendExamLinkMutation.onError`, keep the destructive toast but include the returned `email_error` text so we see the real reason.
- In `sendExamLinkMutation.onSuccess`, keep the success toast unchanged.
- For the bulk path (`sendBulkExamLinksMutation`), count `email_sent === false` results as failures in the summary toast.

No behavioural change when everything works; only removes the silent-success case.

### 2. Server — richer diagnostics (small, additive)
File: `supabase/functions/provision-exam-account/index.ts`

- When `admin.functions.invoke("send-transactional-email", ...)` returns an error, also capture and return the HTTP status if available (`(invokeErr as any)?.context?.status`) in `email_error`, so the client toast tells us whether it's 401 / 403 / 5xx.
- No change to auth, template, or magic-link generation. Still returns `magic_link` so an admin can share it manually if needed.

### 3. Verification
1. Deploy `provision-exam-account`.
2. Ask the admin to click **Send exam link** for the same registration once more.
3. Watch:
   - `email_send_log` for a new row (any status).
   - `provision-exam-account` and `send-transactional-email` edge function logs.
   - The toast text — with the change above it will now show the real failure reason instead of a false success.
4. Based on the surfaced error, apply the targeted fix (e.g. suppression, template registry mismatch, auth). No speculative changes now.

## Out of scope
- Changing `send-transactional-email` auth logic.
- Template or magic-link changes.
- Any change to other emails (course-registration, birthday, etc.) — those are sending fine.
