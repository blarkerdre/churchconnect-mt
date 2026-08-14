Update the member profile phone input placeholder and guidance.

Goal: Replace the current sample number `+447888873207` with a placeholder that uses `XXXXXXXX` formatting and adds an information note explaining how the number should be entered.

Changes:
- In `src/pages/MyProfile.jsx` (around line 839), change the Phone input `placeholder` from `+447888873207` to `+44 XXXXXXXX` (or similar) and add a small helper note below the input indicating the expected format (e.g., "Include your country code; UK numbers start with +44").

Acceptance criteria:
- The Phone input placeholder no longer uses a real-looking sample number.
- A clear, concise info note is visible to the user.
