# Password reset check

## What I found

The flow is wired correctly end to end:

- "Forgot password?" on the sign-in page calls the reset with a redirect back to `/reset-password` (tenant-prefixed when the user came in via a church URL).
- Both `/reset-password` and `/t/:slug/reset-password` are public routes, outside the authenticated area, so the two-step verification gate does not block a locked-out user.
- The reset page sets the new password and then sends the user to their church dashboard.
- Email delivery is healthy: the sending domain is verified, and 61 password-reset emails have gone out successfully (most recent 9 Aug). The only failed reset emails are from May, before the current email queue setup.

So nothing is currently broken in the reset path.

## One weak spot worth fixing

For an account that has an authenticator app enrolled, the session created by a recovery link is "password only" until a 6-digit code is entered. The reset page, after saving the new password, reads the user's church membership to decide where to send them — and that read is blocked for a not-yet-verified session. The password change still succeeds, but the user can land on a bare home page instead of their church, which reads like a failure.

Fix: treat the membership lookup as best-effort — if it returns nothing, fall back to the church slug already in the URL, then to home. Also show a clear confirmation ("Password updated — sign in with your new password") and offer a sign-in link rather than silently redirecting when the destination can't be resolved.

## Verification

Run a live end-to-end check on a test account: request a reset, confirm the email is queued and sent, open the link, set a new password, and confirm sign-in with the new password (including the 6-digit step for a 2FA account).

## Technical notes

- `src/pages/ResetPassword.jsx`: wrap the `tenant_memberships` query in a tolerant path, use `useParams().tenantSlug` as the fallback redirect, and add a success state.
- No changes needed to `src/hooks/useAuth.jsx` (`resetPassword` / `updatePassword`), `src/App.jsx` routing, or the recovery email template.
