
## Plan: Make the Live/Test indicator visible in the places users actually see

### Root cause
The environment logic itself looks correct:
- Preview URLs resolve to `Test`
- Published URLs resolve to `Live`

The problem is UI visibility:
- In `AppLayout.jsx`, the environment badge is only rendered for `isAdmin`
- The published app’s entry point is usually the auth screen, and `Auth.jsx` has no environment badge at all

So if a user is:
- not logged in, or
- logged in without admin access in Live

they won’t see the `Live` label even though the app is correctly running in Live.

### What to build
1. **Show the environment badge for all authenticated users**
   - Remove the `isAdmin` gate around the Test/Live badge in `AppLayout.jsx`
   - Keep the backend mismatch warning restricted to admins, since that is a technical/debug message

2. **Show the environment badge on the auth screen**
   - Add the same Test/Live indicator to `src/pages/Auth.jsx`
   - Place it in a simple visible spot near the logo/header so users can confirm they are on Live before logging in

3. **Optional cleanup**
   - Extract the badge into a small shared component or keep a shared helper-based rendering pattern so the label styling stays consistent across pages

### Files involved
- `src/components/AppLayout.jsx`
- `src/pages/Auth.jsx`
- Optional: new shared component such as `src/components/EnvironmentBadge.jsx`

### Technical details
- Reuse the existing helpers in `src/lib/environment.js`
- Do **not** change backend configuration or detection logic unless a new issue appears
- Do **not** expose backend host/debug details to non-admins
- No database or backend changes needed

### Expected result
After this change:
- Logged-in users will always see `Test` or `Live` in the app header
- Logged-out users visiting the published site will also see `Live` on the sign-in screen
- Admins will still be the only ones who see backend mismatch diagnostics
