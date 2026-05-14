# Sanitize Raw Error Messages in Edge Functions

Replace raw `err.message` / `error.message` in HTTP response bodies with a generic `"An unexpected error occurred"` string, while preserving full details in `console.error` server-side logs.

## Scope

Six edge functions flagged by the scanner:

1. **`auth-email-hook`** (line ~311) — publicly reachable webhook, highest priority.
2. **`process-scheduled-communications`** (line ~29) — DB fetch error branch.
3. **`process-scheduled-followups`** (lines ~33, ~100) — two error branches.
4. **`refresh-sms-status`** (line ~165) — outer catch.
5. **`send-birthday-messages`** (line ~78) — tenant query failure.
6. **`send-event-reminders`** (line ~121) — outer catch.

## Approach

For each location:
- Replace the response body's raw error string with `{ error: "An unexpected error occurred" }`.
- Ensure `console.error(...)` captures the full error before the response is returned.
- Preserve any intentional 4xx validation messages — only the 5xx/internal branches change.
- No behavior change for happy paths; no DB or frontend edits.

## Verification

- Re-read each modified file to confirm no remaining `err.message`/`error.message` leaks in HTTP responses.
- Mark `edge_fn_err_leak_new` as fixed via `security--manage_security_finding`.
- Reaffirm the "no raw error messages in HTTP responses" invariant in `@security-memory`.
