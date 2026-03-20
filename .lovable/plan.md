

## Plan: Show clear error for duplicate email signups

### Problem
When someone signs up with an already-registered email, the auth system silently succeeds (returns no error) to prevent email enumeration. The user sees "Account created! Check your email" but never receives a confirmation — confusing.

### Solution
After a successful `signUp` call, check if the response indicates a fake/obfuscated user (no session, no confirmed email, identity already exists). If so, show a helpful message telling them to sign in instead.

### Changes

**`src/pages/Auth.jsx`** — Update the signup handler:
- After `signUp`, check `data.user.identities` — if it's an empty array, the email is already registered
- Show a toast: "An account with this email already exists. Please sign in instead."
- Switch to login mode instead of showing the "check your email" message

```javascript
} else if (mode === "signup") {
  const { data, error } = await signUp(form.email, form.password, form.fullName);
  if (error) throw error;
  // Detect duplicate email (Supabase returns user with empty identities)
  if (data?.user?.identities?.length === 0) {
    toast({
      title: "Email already registered",
      description: "An account with this email already exists. Please sign in instead.",
      variant: "destructive",
    });
    setMode("login");
  } else {
    toast({ title: "Account created!", description: "Please check your email to verify your account." });
    setMode("login");
  }
}
```

**`src/hooks/useAuth.jsx`** — Update `signUp` to return `data` (already does, no change needed).

### Files affected
- `src/pages/Auth.jsx` — one block change in handleSubmit

