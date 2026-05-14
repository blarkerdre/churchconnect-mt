# Sanitize Raw Error Messages in Edge Functions

The previous round patched 6 admin-side edge functions. The scanner has now flagged 7 more functions still returning raw `err.message` to callers. This plan replaces those with generic error strings while preserving full server-side logging.

## Scope

**Public-reachable (highest risk):**
- `register-tenant` — lines 129 & 177 leak auth/DB errors to unauthenticated callers
- `grade-exam` — line 244 leaks DB errors to any authenticated user
- `send-testimony` — line 206 leaks errors to any member

**Authenticated leader/admin callers:**
- `make-call` — line 275
- `send-sms` — line 461
- `invite-to-tenant` — line 259

**Webhook caller:**
- `stripe-subscription-webhook` — line 310 (could expose Stripe API error details)

## Approach

For each function, in the outer `catch` (and the explicit 4xx leak paths in `register-tenant`):

1. Keep `console.error("<fn> error:", err)` (or add it where missing) so the full error stays in logs.
2. Replace the response body's `err.message` / `error.message` with a generic string: `"An unexpected error occurred"`.
3. Preserve intentional, safe 4xx messages (e.g. validation errors like "Email and password required", "Invalid password", "tenant_id is required"). These are not changed.

### Per-function specifics

- **register-tenant**
  - Line 129 (user creation failure that's not "already registered"): return generic 500 instead of `userError.message`. The "already registered" branch keeps its specific 409 message.
  - Line 177 (tenant creation failure): return generic 500 instead of `Tenant creation failed: ${tenantError.message}`.
  - Add `console.error` for both.

- **grade-exam** (line 244): generic message in 500 response; keep `console.error("grade-exam error:", err)`.

- **send-testimony** (line 206): generic message; keep server-side log.

- **make-call** (line 275): generic message; keep `console.error`. Inner Twilio-error rethrows still bubble to the catch.

- **send-sms** (line 461): generic message; keep `console.error`. The per-recipient `error_message` written to `sms_log` (line 434) is internal storage, not a response — left as-is.

- **invite-to-tenant** (line 259): generic message; add/keep `console.error`.

- **stripe-subscription-webhook** (line 310): generic message; keep `console.error("[stripe-webhook] Error:", error.message)`. Webhook still returns 500 so Stripe will retry.

## Verification

After edits:
1. Confirm each function still compiles (deploy will validate).
2. Mark `edge_fn_err_leak` as fixed via `security--manage_security_finding` with an explanation listing the 7 functions patched.
3. Update `@security-memory` to reaffirm the "no raw error messages in HTTP responses" invariant now that all known offenders are clean.

No DB migrations, no frontend changes, no behavior changes for happy paths.
