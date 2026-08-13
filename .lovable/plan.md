# Why the invite email didn't arrive — and how to fix it

## What the data shows

For the most recent invite (Winners Chapel International, Cardiff, sent 12 Aug 13:04, still pending, expires 19 Aug):

- The invitation record was created successfully, so the invite function ran and the church admin saw a success state.
- No email record exists for that invitation at all — not sent, not failed, not suppressed. The last invitation email that reached the email system was on 26 Apr.
- The recipient is not on the suppression list, has not unsubscribed, and has no account yet (so the "new person" invite path was used, which is the path that is supposed to send the invitation email).

So the invitation itself is fine; the handoff from the invite step to the email step produced nothing at all. The exact runtime cause cannot be confirmed from stored data — the function's own logs for that day are no longer available — so step 1 below is to reproduce it and capture the real error rather than guessing.

Separately, there is a real gap regardless of cause: when the email step fails, the invite is still reported as created, nothing is written to the email history, and the only recovery is to retype the address. That is why this failure went unnoticed.

## Plan

1. **Reproduce and capture the cause.** Send a controlled test invitation to a mailbox we control and read the live function logs for both the invite step and the email step, so the failure point is identified from an actual error rather than inference.

2. **Never lose an invitation email silently.** In the invite function, wrap every email attempt so that any failure (transport error, non-2xx, suppressed recipient) writes a `failed` row to the email history with the real error message and the invitation id. Invitation emails then appear in the Email Dashboard like every other email.

3. **Make the failure visible to the admin.** When email delivery fails, the invite result must clearly say "Invitation created, but the email could not be sent" with the reason, instead of a plain success toast.

4. **Give admins a recovery path.** In the invitations list (User Management for church admins, Tenant Admin for super admins), add per-row:
   - a delivery status column (email sent / not sent, from the email history),
   - the existing Resend action, wired to show the same explicit success/failure feedback,
   - a "Copy invite link" action so an admin can share the join link directly when email delivery is degraded.

5. **Fix whatever step 1 reveals** (for example a misrouted internal call, an auth rejection between the two functions, or a sender-domain issue), then re-send the outstanding invitation for the Cardiff church.

## Technical notes

- Invite path: `supabase/functions/invite-to-tenant/index.ts` calls `send-transactional-email` with the `tenant-invitation` template; that template is present in the registry, and `send-transactional-email` writes an `email_send_log` row on every branch it reaches — the absence of any row points at the call itself, so logging must be added on the caller side (step 2) to close the blind spot.
- Invite link format stays `https://app.churchmanagementsuite.org/accept-invite?token=<token>`; the copy action reuses the stored token, read with the existing `.eq("tenant_id", tenantId)` guard.
- UI changes live in `src/components/tenants/TenantInvitePanel.jsx` (shared by User Management and Tenant Admin).
- No database migration required.
