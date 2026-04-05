

## Make Signup Toast More Visible

### Problem
After signing up, the success toast ("Account created! Please check your email to verify your account.") uses the default toast style which can be easy to miss, especially on mobile.

### Solution
Replace the brief toast with a persistent inline success alert that appears directly in the Auth card after signup. This is much more visible than a transient toast notification.

### Changes to `src/pages/Auth.jsx`

1. Add a `signupSuccess` state (boolean) that gets set to `true` after successful signup
2. After signup, instead of (or in addition to) the toast, show a prominent green `Alert` box at the top of the form with a `CheckCircle2` icon, title "Account created!", and description "Please check your email to verify your account before signing in."
3. The alert stays visible until the user interacts with the login form
4. Keep the toast as a secondary notification, but the inline alert ensures the message is unmissable

### Technical detail

```jsx
// New state
const [signupSuccess, setSignupSuccess] = useState(false);

// After successful signup (line 138 area)
setSignupSuccess(true);

// In the JSX, above the form:
{signupSuccess && (
  <Alert className="bg-green-50 border-green-200 text-green-800 mb-4">
    <CheckCircle2 className="h-4 w-4 text-green-600" />
    <AlertTitle>Account created!</AlertTitle>
    <AlertDescription>Please check your email to verify your account before signing in.</AlertDescription>
  </Alert>
)}
```

### Files changed
- `src/pages/Auth.jsx` — add inline success alert after signup, import `CheckCircle2` and `AlertTitle`

