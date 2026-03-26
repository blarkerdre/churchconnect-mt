

## Plan: Fix Conditional Hook Call in Auth.jsx

### Problem
`Auth.jsx` has a **React hooks rule violation**: `useQuery` on line 69 is placed **after** an early `return` (line 60-66). When `loading` is true, the hook is skipped entirely; when loading becomes false, React sees a different number of hooks and crashes silently — producing a blank white screen.

### Fix
Move the `useQuery` hook (lines 69-82) **above** the `if (loading)` early return (line 60), so all hooks are called unconditionally on every render. The `enabled` option already guards against premature execution.

### File: `src/pages/Auth.jsx`

**Before (simplified):**
```jsx
if (loading) { return <Loading />; }  // line 60

const { data: userMembership, isLoading: membershipLoading } = useQuery({...}); // line 69
```

**After:**
```jsx
const { data: userMembership, isLoading: membershipLoading } = useQuery({...}); // moved up

if (loading) { return <Loading />; }
```

### No other files changed

