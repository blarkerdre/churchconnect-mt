## Goal
Make current check-in state visible to teens/parents on the Teens Check-in page, and prevent duplicate check-in / check-out attempts.

## Changes (frontend only — `src/pages/TeensCheckin.jsx`)

1. **Status badges on teen rows**
   - Guardian teen list (line ~531) and self-pick list (line ~419): show a small pill next to the name — green "Checked in" when `openIds.has(t.id)`, muted "Not checked in" otherwise. Keeps existing "No consent" / "First time" pills.

2. **Status banner in PIN entry screens**
   - `parent-pin`, `self-pin`, and signed-in `pendingTeen` PIN forms: once a teen is selected, show a small info line above the PIN input: "✓ Currently checked in — entering PIN will check them out." or "○ Not checked in yet — entering PIN will check them in."

3. **Handle duplicate responses**
   - `teen_checkin` / `teen_self_checkin` already return `already_checked_in` / `already_checked_out`. Extend the success card so those two actions render a distinct info state ("You're already checked in" / "You're already checked out") instead of the celebratory welcome/farewell image, and refresh `openIds` so the UI reconciles.

4. **Guard the action buttons**
   - Poll `refreshOpenIds` right before submit inside `doCheckin` / `doSelfCheckin` is not needed — RPC is authoritative. But disable the submit button for a short window after click (already handled by `busy`), and after a successful action re-run `refreshOpenIds` (already done). Add an `aria-live` region on the status pill so screen readers announce state changes.

No backend / RPC changes. No changes to session or enrolment flows.

## Files touched
- `src/pages/TeensCheckin.jsx`
