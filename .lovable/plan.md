

## Fix: Submit Feedback Button Not Working

### Root Cause
`AppFeedbackDialog.jsx` line 13 uses `const { session } = useAuth()` and then `session?.user?.id` to get the user ID. However, `useAuth` exposes `user` directly — not `session`. So `userId` is always `undefined`, which keeps the button permanently disabled.

### Fix

**`src/components/feedback/AppFeedbackDialog.jsx`** — Change line 13 and 16:
```jsx
// Before
const { session } = useAuth();
const userId = session?.user?.id;

// After
const { user } = useAuth();
const userId = user?.id;
```

### Files Changed
- `src/components/feedback/AppFeedbackDialog.jsx` (2-line fix)

