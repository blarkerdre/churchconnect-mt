# Fix invitation and invoice email authorization

## Confirmed diagnosis

- The sender domain is verified and the Live email queue is healthy, so this is not a DNS or queue outage.
- Both invitation resend and invoice sending call the same internal app-email function.
- The invoice runtime log records that shared function returning `401 Unauthorized`; the invitation uses the same call path and reports the same non-2xx error.
- The failure occurs at the internal authorization boundary before rendering or queueing the email.

## Plan

1. **Harden the internal email call.** Make the invitation and invoice functions send the backend service credential explicitly in both required authorization headers when invoking the shared email function, rather than relying on implicit client header propagation.

2. **Keep the shared sender private.** Retain in-function validation for either a trusted backend service call or a valid signed-in user; do not make the email endpoint publicly callable. Align its deployment setting and stale comments with that validation model.

3. **Expose useful failures safely.** When an internal email call fails, read and log the response body without exposing credentials, so admins receive the actual reason instead of only “Edge Function returned a non-2xx status code.” Preserve invitation failure logging in the email history.

4. **Deploy the complete call chain.** Deploy the shared sender, invitation function, and invoice function together so source, authorization behavior, and runtime configuration cannot remain out of sync.

5. **Verify both affected workflows.** Re-send the pending invitation and send an invoice to a controlled address. Confirm each request returns success, creates one deduplicated email-history entry, advances from queued to sent, and no new 401 appears in the function logs.

## Technical scope

- Functions: `send-transactional-email`, `invite-to-tenant`, and `send-tenant-invoice` only.
- No DNS, database schema, template, recipient, or UI layout changes.
- No weakening of authentication and no secrets written to source or logs.
