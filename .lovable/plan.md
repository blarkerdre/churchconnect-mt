

## Add Signup Cooldown/Debounce

### What
After a successful signup submission, disable the signup button for 60 seconds to prevent duplicate confirmation emails from rapid re-submissions.

### How
In `src/pages/Auth.jsx`:

1. Add a `signupCooldown` state (boolean) and a `cooldownSeconds` state (number)
2. After a successful signup (lines 107-117), set `signupCooldown = true` and `cooldownSeconds = 60`
3. Start a `setInterval` that counts down `cooldownSeconds` every second, clearing when it hits 0
4. Disable the submit button when `signupCooldown` is true (in addition to existing `submitting` check)
5. Show countdown text on the button: "Resend in 45s" instead of "Sign Up"
6. Clear cooldown timer on unmount via cleanup in useEffect

### Files changed
- **`src/pages/Auth.jsx`** — add cooldown state + timer logic + button disabled state

