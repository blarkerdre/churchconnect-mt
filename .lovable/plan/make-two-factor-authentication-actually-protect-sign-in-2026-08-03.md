# Make two-factor authentication actually protect sign-in

## What's happening now

Enrolment works — 4 accounts already have a verified authenticator app (plus 2 half-finished enrolments). What's missing is the second half of 2FA:

- After entering email + password, the app lets the user straight in. It never asks for the 6-digit code, so an enrolled account is no safer than a non-enrolled one.
- There is no screen to see whether 2FA is on, to turn it off, or to turn it on deliberately. The only entry point is a pop-up that appears once per browser session and disappears for good once dismissed.
- Abandoned enrolments leave stale half-set-up authenticators behind, which can block a later retry.

## What will change

1. **Ask for the code at sign-in.** Right after password sign-in (and after session restore on page load), check the account's assurance level. If the account has a verified authenticator and the current session hasn't been verified, show a "Enter your 6-digit code" step and hold the user there — no app access until the code passes. Includes a "sign out / use another account" escape and clear errors for a wrong or expired code.

2. **A real 2FA section in My Profile → Security.** Shows current status (On / Off), lets the user set up an authenticator (QR + manual key + verify), and lets them remove it after re-entering their account password (matching the existing delete-confirmation rule).

3. **Clean up stale enrolments.** Before starting a new enrolment, remove any leftover unverified factor so retries never fail with "factor already exists". Cancelling the dialog also unenrols the pending factor.

4. **Keep the nudge, make it dismissible properly.** The existing prompt stays for users without 2FA, but "Remind me later" continues to snooze for 7 days, and the dialog links to the new profile section instead of being the only path.

## Technical notes

- Gate: `supabase.auth.mfa.getAuthenticatorAssuranceLevel()` — when `currentLevel === 'aal1'` and `nextLevel === 'aal2'`, render the challenge screen. Expose this as `mfaRequired` from `useAuth` (`src/hooks/useAuth.jsx`) and render the challenge in `src/App.jsx` above the authenticated routes so every route is covered.
- Challenge uses `mfa.challengeAndVerify({ factorId })` on the verified TOTP factor, then re-reads the assurance level to release the gate.
- New component `src/components/security/TwoFactorSection.jsx` used in `src/pages/MyProfile.jsx`; enrol/verify logic moved out of `MFASetupDialog.jsx` into a shared hook so both use one code path.
- Unenrol via `supabase.auth.mfa.unenroll({ factorId })`, wrapped in the existing `useConfirmDelete()` password re-entry flow.
- Password reset / recovery links must bypass the gate so a locked-out user can still reach `/reset-password`.

## Note on lock-out

Once sign-in enforces the code, anyone who loses their authenticator device cannot get in on their own. Recovery would need an admin action. Say the word if you want an admin "reset 2FA for this user" control included in the same change.
