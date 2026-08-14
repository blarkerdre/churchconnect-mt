Apply the same phone-number placeholder and info note to all member-facing forms.

Goal: Replace the old sample number `+447888873207` with the `+44 XXXXXXXX` placeholder and add an information note on every form where a user enters a phone number.

Files to update:
1. `src/pages/PublicRegistration.jsx` (around lines 224–232)
   - Replace the info text example from `+447888873207` to `+44 XXXXXXXX`.
   - Replace the input placeholder with `+44 XXXXXXXX`.
   - Replace the validation error example with `+44 XXXXXXXX`.
2. `src/components/members/MemberFormDialog.jsx` (around lines 536–548)
   - Replace the info text example with `+44 XXXXXXXX`.
   - Replace the input placeholder with `+44 XXXXXXXX`.
   - Replace the validation error example with `+44 XXXXXXXX`.

Acceptance criteria:
- No form in the app shows a real-looking sample phone number (`+447888873207`).
- All phone inputs for members/parents use the `+44 XXXXXXXX` placeholder.
- All guidance/error messages reference the same masked example.
