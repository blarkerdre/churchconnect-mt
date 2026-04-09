## Show Post-Registration Notification with Exam Link

### Problem

After registering for a course via the QR code public form, the success screen only says "You will be contacted with further details." There's no way for the student to know where to go to take their exam or how to access the app.

### Solution

Enhance the success screen in `PublicWoFBIRegistration.jsx` to:

1. Show a clear message explaining the next steps — they need to create an account or log in to take exams
2. Add a "Go to Login" button that links to the tenant-scoped auth page (`/t/{tenantSlug}/auth`)
3. Mention that exams are available in the Bible School section once logged in

### Changes

#### `src/pages/PublicWoFBIRegistration.jsx`

Update the success screen (lines 119–142) to add:

- A short "What's Next?" section explaining they need an account to access exams
- A "Login / Create Account" button linking to `/t/{tenantSlug}/auth`
- Keep the existing "Register Another Person" button

The success screen will look like:

```text
✓ Registration Successful!
You have been registered for [Course Name].

What's next?
To access and take exams, 
log in or create an account.

[ Login / Create Account ]    [ Register Another Person ]
```

### Files changed

- `src/pages/PublicWoFBIRegistration.jsx` — enhance success screen with next-steps info and login link