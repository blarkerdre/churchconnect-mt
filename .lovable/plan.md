

## Fix: Reset Password Not Working

### Root Cause
When a user clicks the password reset link in their email, the URL is `/t/:tenantSlug/reset-password` (or `/reset-password`). Both paths fall into the `AuthRoutes` component where:
- `/reset-password` is matched correctly BUT is nested inside `ProtectedRoute`'s catch-all, so if the recovery session isn't established instantly, the user gets bounced to login.
- `/t/:tenantSlug/reset-password` has NO dedicated route — it matches the tenant `ProtectedRoute` wildcard, which redirects unauthenticated users to the auth page.

### Fix
Move the reset password routes OUT of `AuthRoutes` and into `AppRoutes` as public routes (same pattern as `/auth`), wrapped only in `AuthProvider` (needed for `useAuth` hook) but NOT in `ProtectedRoute`.

### Implementation

**Edit `src/App.jsx`**:

1. Add two new public routes in `AppRoutes` (before the `/*` catch-all):
   ```jsx
   <Route path="/reset-password" element={<AuthProvider><ResetPassword /></AuthProvider>} />
   <Route path="/t/:tenantSlug/reset-password" element={<AuthProvider><ResetPassword /></AuthProvider>} />
   ```

2. Remove the `/reset-password` route from inside `AuthRoutes` (line 147).

### Files changed
- **Edit**: `src/App.jsx` — move reset password routes to public scope

