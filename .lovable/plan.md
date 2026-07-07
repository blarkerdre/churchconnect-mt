## Problem

Four members (Chika Ugwu, Abisoye Famojuro, Justin Miller, Katie Miller) were approved for the "Believers Foundation Class (BFC)" certificate by the Training Rep, but their certificates never got generated.

**Root cause:** In `src/pages/CertificateApprovals.jsx` the approve handler:
1. Flips `training_attendees.signpost_status` to `"approved"` in the database.
2. Then invokes the `issue-certificate` edge function.
3. Only if step 2 succeeds does it flip the status to `"issued"` and save the certificate number.

If step 2 fails (transient wasm/font fetch error, storage timeout, network glitch, etc.) the row is left permanently in `"approved"` with no `certificate_number`. Nothing in the UI surfaces or retries these stuck records — they no longer appear on the Pending tab, and the Approved tab today has no action button.

Verified in DB: all 4 rows have `signpost_status='approved'`, `certificate_number=NULL`, `decision_by` set — and there is **no matching row in `training_completions`**, confirming the edge function never completed.

## Fix

Two small, focused changes in `src/pages/CertificateApprovals.jsx` (frontend only — the edge function itself already works; other members in the same tenant were issued successfully):

1. **Add a "Retry Issue" action** on the Approved tab for any row where `signpost_status='approved'` AND `certificate_number` is empty. Clicking it re-invokes `issue-certificate` with the same payload the original approve used, and on success updates the row to `signpost_status='issued'` + saves the cert number (identical to the tail of `handleApprove`). On failure, show the actual error message in the toast so the admin can see why (fonts, storage, RLS, etc.).

2. **Add a small "Needs re-issue" badge / red dot** on the Approved tab count and next to rows missing a certificate number so admins immediately see there is unfinished work.

Optionally (nice-to-have, still frontend-only): reorder `handleApprove` to invoke `issue-certificate` FIRST, and only update `training_attendees` after the certificate is generated. That way a future edge-function failure leaves the row on the Pending tab and the admin can just click Approve again. This is a safer flow going forward.

## What will not change

- No edge function changes (`issue-certificate` is working — 3 other rows in the same tenant were successfully issued).
- No schema changes.
- No changes to grading, exam attempts, or `training_completions` logic.
- Existing 4 stuck rows will be resolved by the admin clicking the new **Retry Issue** button once.

## Files touched

- `src/pages/CertificateApprovals.jsx` — add `handleRetryIssue`, render Retry button + warning badge on Approved tab, optionally reorder `handleApprove`.
