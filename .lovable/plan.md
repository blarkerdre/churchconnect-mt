# No code changes needed

The 1-hour magic-link expiry only limits **when the applicant must first click the email**. Once clicked, they receive a normal auth session with a long-lived refresh token that auto-refreshes during the exam, so the exam runs to its own `duration_minutes` regardless of how long it takes.

If a link ever expires before the applicant clicks it, the admin can already re-send from the WoFBI Applications tab (existing "Resend exam link" button re-runs `provision-exam-account` idempotently).

Nothing to build or change.